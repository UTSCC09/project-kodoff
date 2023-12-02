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

function extractErrMsg(err) {
    const lines = err.split('\n');
    if (lines.length < 2) {
        return '';
    }
    return lines[lines.length - 2];
}

function generateRandomString(length){
    return Math.random().toString(36).substring(2, 2+length);
};

function constructPythonScript(userFunction, testCases, testResults, randomSeed) {
    // Start with the user's function
    let script = userFunction + "\n\n";

    // Add a function to run test cases
    script += `def run_test_cases():
    passed = 0
    failed = 0
    test_cases = ${JSON.stringify(testCases)}
    expected_results = ${JSON.stringify(testResults)}
    for i, test_case in enumerate(test_cases):
        result = kodoff(eval(test_case))
        if (result == (expected_results[i]) or result == (eval(expected_results[i]))):
            passed += 1
        else:
            failed += 1
    return passed, failed\n\n`;

    // Add the logic to call run_test_cases and print the results
    script += `passed, failed = run_test_cases()
print(f"` + randomSeed + `&` + `{passed}` + `&` + `{failed}` + `&` + `{passed} test cases passed, {failed} test cases failed")\n`;

    return script;
}

function extractLineWithSeed(output, randomSeed) {
    const lines = output.split('\n');
    for (let line of lines) {
        if (line.includes(randomSeed)) {
            return line.split('&');
        }
    }
    throw new Error('Test cases for function kodoff fail to be executed.');
}

export function execPythonScript(scriptContent, tests) {
    return new Promise((resolve, reject) => {
        try {
            console.log(tests);
            const randomSeed = generateRandomString(10); // To prevent users from faking results
            const userFunction = sanitizePythonCode(scriptContent);
            const sanitizedScriptContent = constructPythonScript(userFunction, tests.test_cases, tests.test_results, randomSeed)
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
    
            const command = `docker ${dockerArgs.join(' ')}`;
            const process = exec(command);

            let output = '';
            let errorOutput = '';

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
                    return resolve({ status: false, output: 'Script execution timed out.' });
                }

                if (code !== 0) {
                    let errmsg = extractErrMsg(errorOutput)
                    return resolve({ status: false, output: `Script exited with code ${code} \n` + errmsg });
                }

                if (signal) {
                    let errmsg = extractErrMsg(errorOutput)
                    return resolve({ status: false, output: `Script was terminated by signal ${signal} \n` + errmsg });
                }
                
                const result = extractLineWithSeed(output, randomSeed);

                if((parseInt(result[2], 10) == 0) && (parseInt(result[1], 10) > 0)){
                    return resolve({ status: true, output: result[3] });
                }
                else{
                    return resolve({ status: false, output: result[3] });
                }
            });

            process.on('error', function(error) {
                clearTimeout(timeout);
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                return resolve({ status: false, output: error.message });
            });

            const timeout = setTimeout(() => {
                console.error(`Terminating Docker container ${containerName} due to timeout.`);
                exec(`docker kill ${containerName}`);
                process.killedByTimeout = true;
            }, 12000);  // 12 seconds timeout

        } catch (error) {
            return resolve({ status: false, output: error.message });
        }
    });
};