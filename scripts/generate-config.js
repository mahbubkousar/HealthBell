const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '..', 'assets', 'app-config.js');

fs.readFile(configFile, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading config file:', err);
        process.exit(1);
    }

    let result = data
        .replace(/__GEMINI_API_KEY__/g, process.env.GEMINI_API_KEY)
        .replace(/__NEWS_API_KEY__/g, process.env.NEWS_API_KEY);

    fs.writeFile(configFile, result, 'utf8', (err) => {
        if (err) {
            console.error('Error writing config file:', err);
            process.exit(1);
        }
        console.log('Config file generated successfully.');
    });
});