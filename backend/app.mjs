import express from "express";
import { execPythonScript } from './server/dockerManager.mjs';
import { createServer } from "http";
import Datastore from 'nedb';

// Initialize the NeDB database
const problemsDb = new Datastore({ filename: "db/problems.db", autoload: true });

const PORT = 3000;
const app = express();

app.use(express.json());

// Function to get a random problem
function getRandomProblem() {
  return new Promise(function(resolve, reject){
    problemsDb.find({}, (err, problems) => {
      if (err) {
        return reject(err);
      }
      if (problems.length === 0) {
        return reject(new Error("No problems available"));
      }
      const randomIndex = Math.floor(Math.random() * problems.length);
      return resolve({ _id: problems[randomIndex]._id, desc: problems[randomIndex].desc });
    });
  })
}

function getProblemTestsById(id) {
  return new Promise((resolve, reject) => {
      problemsDb.findOne({ _id: id }, (err, problem) => {
          if (err) {
              return reject(err);
          }
          if (!problem) {
              return reject(new Error("Problem not found"));
          }
          return resolve({ test_cases: problem.test_cases, test_results: problem.test_results });
      });
  });
}

app.get("/api/problems/", async function(req, res, next){
  const problem = await getRandomProblem();
  return res.json(problem)
})

app.post('/execPython', async function(req, res, next) {
  const tests = await getProblemTestsById(req.body.problemId)
  const result = await execPythonScript(req.body.code, tests);
  res.json({ success: result.status , result: result.output });
});


app.use(express.static("static"));

export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});
