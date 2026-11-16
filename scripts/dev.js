process.env.PATH = "/Users/j1/.local/node/bin:" + (process.env.PATH || "");
process.argv = [process.argv[0], process.argv[1], "dev", "--webpack", "-p", "3000"];
require("/Users/j1/Downloads/insurance-ai-platform/node_modules/next/dist/bin/next");
