module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
    "plugins": ["node"],
    "extends": ["eslint:recommended"],
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "quotes": [
            "error",
            "single"
        ],
        "no-undef": ["warn"],
    }
};
