import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sanitizePythonCode(scriptContent) {
    // List of disallowed imports
    const disallowedImports = ['os', 'sys', 'subprocess', 'socket', 'shutil'];
    const disallowedImportRegex = new RegExp(`import\\s+(${disallowedImports.join('|')})`, 'g');

    // Detect file I/O operations
    const fileOperationsRegex = /open\(|read\(|write\(/g;

    // Check for disallowed imports
    if (disallowedImportRegex.test(scriptContent)) {
        throw new Error('Disallowed import statement detected.');
    }

    // Check for file I/O operations
    if (fileOperationsRegex.test(scriptContent)) {
        throw new Error('File I/O operations are not allowed.');
    }

    return scriptContent; 
}

export const execPythonScript = function(scriptContent, callback) {
    try {
        const sanitizedScriptContent = sanitizePythonCode(scriptContent);
        const tempPyDir = path.join(__dirname, 'tempPy');
        if (!fs.existsSync(tempPyDir)) {
            fs.mkdirSync(tempPyDir, { recursive: true });
        }

        const tempFilePath = path.join(tempPyDir, `script_${Date.now()}.py`);
        fs.writeFileSync(tempFilePath, sanitizedScriptContent);

        const containerName = `python_exec_${Date.now()}`;
        const dockerArgs = [
            'run', '--rm', '--name', containerName,
            '--memory=100m', '--cpus=0.5',
            '--network', 'none', '--security-opt=no-new-privileges',
            '--tmpfs', '/run:rw,noexec,nosuid,size=65536k',
            '-v', `"${tempFilePath}:/usr/src/app/script.py"`,
            'python-exec-env', 'python', '/usr/src/app/script.py'
        ];

        /*
        Security measures flags:

        --rm : removes the container when it exists to prevent unintentional container left running
        --memory=100m : limits max amount of usable memory by contaiiner to 100mb
        --cpus=0.5s : limits usable cpu by container to 0.5
        --network none: disables network usage for contaiiner
        --security-opt=no-new-privileges: ensures container privileges is not increased over time
        --tmpfs', '/run:rw,noexec,nosuid,size=65536k:
            rw: read write access within the scope of the temporary file system's /run directory inside of the container
            noexec: execution of binaries from the temporary file system is disallowed
            nosuid: set-user-ID and set-group-ID bits are ignores
            size=65536k: limits the overall size of the temporary file system to 65536 kilobytes
        */

        const command = `docker ${dockerArgs.join(' ')}`;
        let output = '';
        let errorOutput = '';

        const process = exec(command);
        process.stdout.on('data', (data) => {
            output += data;
        });
    
        process.stderr.on('data', (data) => {
            errorOutput += data;
        });

        process.on('exit', function(code, signal) {
            clearTimeout(timeout);
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            if (process.killedByTimeout) {
                return callback(new Error('Script execution timed out.'), null, null);
            }

            if (code !== 0) {
                const error = new Error(`Script exited with code ${code}`);
                return callback(error, output, errorOutput);
            }
        
            if (signal) {
                const signalError = new Error(`Script was terminated by signal ${signal}`);
                return callback(signalError, output, errorOutput);
            }
        
            return callback(null, output, errorOutput);
        });

        process.on('error', function(error) {
            clearTimeout(timeout);
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            return callback(err, null, null);
        });

        const timeout = setTimeout(() => {
            console.error(`Terminating Docker container ${containerName} due to timeout.`);
            exec(`docker kill ${containerName}`);
            process.killedByTimeout = true;
        }, 10000);  // 10 seconds timeout

    } catch (error) {
        return callback(error, null, null);
    }
};