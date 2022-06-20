# Personal boilerplate

This repo is the personal boilerplate to work with TypeScript, ESM, Prettier and ESLint together.

- You can learn more about [my coding style here](https://github.com/thetutlage/meta/discussions/3).
- Checkout the setup I follow for [ESM and TypeScript here](https://github.com/thetutlage/meta/discussions/2).

## Setup

Either you can use this template to create a new repository from within the Github user interface or clone the repo locally. 

### Use as template
![](./use-as-template.png)

### Clone repo locally
```sh
git clone https://github.com/thetutlage/boilerplate.git

# Remove origin
git remote remove origin
```

### Install dependencies
Once done, `cd` into the cloned repo and install the dependencies from the npm registry. I personally use npm, however you can use `yarn` or `pnpm`.

```sh
npm i
```

### Customize repo
The final bit is to get rid of the placeholder variables placed inside different files with your custom values.

1. Open `data.json` file and define the value for all the pre-defined keys.
2. Run `sh ./customize.sh`.
3. Uninstall `ejs` by running `npm uninstall ejs`. Ejs is used for interpolating placeholders.
3. Sit back and relax.
