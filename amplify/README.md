# Flow Platform - Frontend

**Visual drag-and-drop interface for designing, running and exporting CI/CD pipelines. Built with React, TypeScript, and ReactFlow.**

## Key features

- **Pipeline canvas** — drag-and-drop stages and tasks (React Flow)
- **Agent chat** — describe your repo and the AI generates a pipeline (Bedrock AgentCore)
- **Run pipeline** — execute the pipeline on ephemeral Lambda MicroVM runners; stage rings turn green in real time
- **Run panel** — expandable side panel showing stage status, step logs and elapsed time
- **Export** — generate GitHub Actions, GitLab CI, Jenkins, CodePipeline or Bitbucket config files

## Running locally

```bash
cp .env.example .env.local   # fill in Cognito + API endpoints from terraform output
npm install
npm start                    # http://localhost:3000
```
