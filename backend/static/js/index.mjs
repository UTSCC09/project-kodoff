import {
    postPythonCode,
    getProblem
} from "./api.mjs";

let problem_id;

function updateProblem(problem){
  console.log(problem)
  problem_id = problem._id
  document.getElementById('problem').innerText = problem.desc
}

function updateResult(res){
  console.log(res)
  document.getElementById('output').innerText = res.result;
}

document.getElementById('run').addEventListener('click', function() {
  const code = document.getElementById('code').value;
  postPythonCode(code, problem_id).then(updateResult);
});

getProblem().then(updateProblem);

// Event listener for handling Tab key in the textarea
document.getElementById('code').addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        e.preventDefault();  // Prevent the default tab behavior
        var start = this.selectionStart;
        var end = this.selectionEnd;

        // Set textarea value to: text before caret + tab + text after caret
        this.value = this.value.substring(0, start) +
                     "\t" +  // The tab character
                     this.value.substring(end);

        // Put caret at right position again
        this.selectionStart = this.selectionEnd = start + 1;
    }
});