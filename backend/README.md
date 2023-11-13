# Secure Python Runner

The Python Code is executed in using Docker as we are dealing with untrusted or external code. Docker provides a more secure and controlled environment compared to executing the code directly in a child process due to the isolation, resource control, and environmental consistency offered.

The Docker Container created is also as light as possible, it is based on python:3.9-slim and the only imported library by default is numpy

## Getting Started
### Prerequisites

What things you need to install the software:

- Docker
- Node.js

### Installing and Running

A step-by-step series of examples that tell you how to get a development environment running:

#### Setting Up the Docker Environment

1. **Build the Docker Image**

   In this directory that contains the Dockerfile and run the following command to build the Docker image:

   ```bash
   docker build -t python-exec-env .
   ```

#### Setting Up the Docker Environment

2. **Install Node Dependencies**

    In this directory, run the following command to install all node dependencies
    
    ```bash
    npm install
    ```

3. **Start the Application**

    To start the application in development mode at Port 3000, run:
    
    ```bash
    npm run dev
    ```

## Credits
- Stack Exchange
- OpenAI's ChatGPT
- Docker Documentation
- W3Schools