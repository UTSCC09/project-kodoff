import Datastore from 'nedb';

// Initialize the database
const db = new Datastore({ filename: "db/problems.db", autoload: true });

// Sample problems without _id
const problems = [
    {
        desc: "Give a function named kodoff that takes in an array of integers and returns the average",
        test_cases: ["[1,2,3]", "[3,4,5]", "[4,5,9]"],
        test_results: ["2", "4", "6"]
    },
    {
        desc: "Write a function named kodoff to find the maximum number in an array of integers",
        test_cases: ["[5,3,9]", "[1,2,3]", "[4,5,6,7]"],
        test_results: ["9", "3", "7"]
    },
    {
        desc: "Create a function named kodoff that returns the sum of two numbers",
        test_cases: ["[1, 2]", "[3, 4]", "[5, 6]"],
        test_results: ["3", "7", "11"]
    },
    {
        desc: "Implement a function named kodoff that reverses a string",
        test_cases: ['"hello"', '"world"', '"kodoff"'],
        test_results: ['"olleh"', '"dlrow"', '"ffodok"']
    }
];

// Function to add a problem to the database
function addProblem(problem) {
    db.insert(problem, (err, newDoc) => {
        if (err) {
            console.error("Error adding problem:", err);
        } else {
            console.log("Added new problem:", newDoc);
        }
    });
}

// Add each problem to the database
problems.forEach(problem => addProblem(problem));