import Datastore from 'nedb';

// Initialize the database
const db = new Datastore({ filename: "db/problems.db", autoload: true });

// Sample problems without _id
const problems = [
    // Simpler Problems
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
        desc: "Implement a function named kodoff that reverses a string",
        test_cases: ['"hello"', '"world"', '"kodoff"'],
        test_results: ['"olleh"', '"dlrow"', '"ffodok"']
    },
    {
        desc: "Create a function named kodoff that returns the sum of two numbers from a single array of length 2",
        test_cases: ["[1, 2]", "[5, 7]", "[10, -3]"],
        test_results: ["3", "12", "7"]
    },
    {
        desc: "Write a function named kodoff that checks if a number is even and returns a boolean",
        test_cases: ["2", "3", "10"],
        test_results: ["true", "false", "true"]
    },

    // More Challenging Problems
    {
        desc: "Write a function named kodoff that takes an array of integers and returns an array of these integers squared",
        test_cases: ["[1, 2, 3]", "[4, 5, 6]", "[-7, -8, 0]"],
        test_results: ["[1, 4, 9]", "[16, 25, 36]", "[49, 64, 0]"]
    },
    {
        desc: "Create a function named kodoff that finds the longest word in a sentence",
        test_cases: ['"Hello world"', '"The quick brown fox"', '"A lazy dog"'],
        test_results: ['"Hello"', '"quick"', '"lazy"']
    },
    {
        desc: "Implement a function named kodoff that returns the factorial of a number",
        test_cases: ["5", "3", "0"],
        test_results: ["120", "6", "1"]
    },
    {
        desc: "Design a function named kodoff that takes an array of strings and returns a string of those elements concatenated together, separated by commas only",
        test_cases: ['["apple", "banana", "cherry"]', '["dog", "cat"]', '["sun", "moon", "stars"]'],
        test_results: ['"apple,banana,cherry"', '"dog,cat"', '"sun,moon,stars"']
    },
    {
        desc: "Write a function named kodoff that takes an array of integers and returns the greatest common divisor (GCD) of them",
        test_cases: ["[8, 12]", "[14, 28, 42]", "[100, 80, 60]"],
        test_results: ["4", "14", "20"]
    },
    {
        desc: "Implement a function named kodoff that returns the n-th Fibonacci number",
        test_cases: ["5", "8", "0"],
        test_results: ["5", "21", "0"]
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