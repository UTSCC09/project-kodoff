import {
    postPythonCode,
} from "./api.mjs";

document.getElementById('run').addEventListener('click', function() {
  const code = document.getElementById('code').value;
  postPythonCode(code, function (err, data) {
    if (err) {
      console.error('Error:', err);
      document.getElementById('output').innerText = err;
    } else {
      document.getElementById('output').innerText = data.output || '';
    }
  });
});

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