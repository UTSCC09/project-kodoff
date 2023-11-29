function send(method, url, data){
  console.log(method, url, data)
  return fetch(url, {
      method: method,
      headers: {"Content-Type": "application/json"},
      body: (data)? JSON.stringify(data): null,
  })
  .then(x => x.json())
}

export function getProblem(){
  return send("GET", "/api/problems/", null);
};

export function postPythonCode(code, problemId) {
  return send("POST", "/execPython", {code, problemId});
}