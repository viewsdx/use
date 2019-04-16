const { execSync } = require('child_process')
const boxen = require('boxen')
const chalk = require('chalk')
const fs = require('fs')
const hasYarn = require('has-yarn')
const ora = require('ora')
const path = require('path')
const getLatestVersion = require('latest-version')
const updateNotifier = require('update-notifier')

const cwd = process.cwd()
const pkgPath = path.join(cwd, 'package.json')
const thisPkg = require('./package.json')

if (thisPkg.name === 'use-views') {
  console.log(
    boxen(
      [
        chalk.red(
          `use-views is deprecated, use @viewstools/use instead. Run this to update:`
        ),
        chalk.green(`npm install --global @viewstools/use`),
        chalk.green(`npm uninstall --global use-views`),
      ].join('\n'),
      {
        padding: 1,
      }
    )
  )
} else {
  updateNotifier({
    pkg: thisPkg,
    updateCheckInterval: 0,
  }).notify()
}

if (!fs.existsSync(pkgPath)) {
  unsupported()
  process.exit()
}

const pkg = require(pkgPath)
const isReactDom = 'react-dom' in pkg.dependencies
const isReactNative = 'react-native' in pkg.dependencies

if (!pkg.devDependencies) {
  pkg.devDependencies = {}
}

// exit if this is already a views-morph project
if ('@viewstools/morph' in pkg.devDependencies) {
  console.log(chalk.blue(`This is already a Views project! 🔥 🎉 \n`))
  help()
  process.exit()
}

if (!isReactDom && !isReactNative) {
  unsupported()
  process.exit()
}

console.log(
  `In a few minutes, your ${
    isReactDom ? 'web' : 'native'
  } project will be ready to use Views! 😇\n`
)

let spinner = ora('Getting the latest versions of Views dependencies').start()

const addDependency = (dep, version) => (pkg.dependencies[dep] = `^${version}`)
const addDevDependency = (dep, version) =>
  (pkg.devDependencies[dep] = `^${version}`)

async function run() {
  // dependencies
  await Promise.all([
    getLatestVersion('@viewstools/morph'),
    getLatestVersion('concurrently'),
  ]).then(([morph, concurrently]) => {
    addDevDependency('@viewstools/morph', morph)
    addDevDependency('concurrently', concurrently)
  })

  if (isReactDom) {
    await Promise.all([getLatestVersion('emotion')]).then(([emotion]) => {
      addDependency('emotion', emotion)
    })
  }

  spinner.succeed()
  spinner = ora('Setting up the project').start()

  // setup scripts
  pkg.scripts.dev = pkg.scripts.start
  pkg.scripts.start = `concurrently --names 'react,views' --handle-input npm:dev npm:views`
  pkg.scripts.views = `views-morph src --watch --as ${
    isReactDom ? 'react-dom' : 'react-native'
  }`
  if (isReactDom) {
    pkg.scripts.prebuild = `views-morph src --as react-dom`
  }

  // write package.json
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

  spinner.succeed()
  spinner = ora('Installing the dependencies').start()

  // install the dependencies
  execSync(hasYarn(cwd) ? 'yarn' : 'npm install')

  spinner.succeed()
  spinner = ora('Preparing a sample View for you to work with').start()

  // create a src directory
  try {
    fs.mkdirSync(path.join(cwd, 'src'))
  } catch (err) {}
  try {
    fs.mkdirSync(path.join(cwd, 'src', 'Main'))
  } catch (err) {}

  // bootstrap files
  if (isReactDom) {
    // in src/index.js
    const indexPath = path.join(cwd, 'src', 'index.js')
    const index = fs.readFileSync(indexPath, { encoding: 'utf-8' })
    // set App to load App.view.logic
    fs.writeFileSync(
      indexPath,
      index.replace(`./App`, `./Main/App.view.logic.js`)
    )

    // remove unused files
    ;['App.css', 'App.js', 'App.test.js', 'logo.svg'].forEach(f => {
      try {
        fs.unlinkSync(path.join(cwd, 'src', f))
      } catch (err) {}
    })

    // write views flexbox first css
    fs.writeFileSync(path.join(cwd, 'src', 'index.css'), VIEWS_CSS)

    // write App.view.logic.js
    fs.writeFileSync(
      path.join(cwd, 'src', 'Main', 'App.view.logic.js'),
      APP_VIEW_LOGIC_DOM
    )
  } else {
    // write App.js
    fs.writeFileSync(path.join(cwd, 'App.js'), APP_NATIVE)

    // write App.view.logic.js
    fs.writeFileSync(
      path.join(cwd, 'src', 'Main', 'App.view.logic.js'),
      APP_VIEW_LOGIC_NATIVE
    )

    // write fonts.js
    fs.writeFileSync(path.join(cwd, 'assets', 'fonts.js'), FONTS_NATIVE)
  }

  // add views generated files to .gitignore
  fs.appendFileSync(path.join(cwd, '.gitignore'), GITIGNORE)

  // write App.view
  fs.writeFileSync(path.join(cwd, 'src', 'Main', 'App.view'), APP_VIEW)

  spinner.succeed()

  console.log('🦄 \n')

  // :)
  console.log(chalk.blue(`This is now a Views project 🎉!!!`))

  console.log(
    `Go ahead and open the file ${chalk.green(
      'src/Main/App.view'
    )} in your editor and change something ✏️`
  )
  console.log(
    `If this is your first time using Views, here's how to get your editor to understand Views files ${chalk.blue(
      'https://github.com/viewstools/docs#syntax-highlighting'
    )}`
  )
  help()
}

function help() {
  if (isReactDom) {
    console.log(
      `Run it with ${
        hasYarn(cwd) ? chalk.green('yarn start') : chalk.green('npm start')
      }\n`
    )
  } else {
    console.log(
      `Run the iOS simulator with ${chalk.green(
        'npm run ios'
      )} and the Android one with ${chalk.green('npm run android')}`
    )
    console.log(`
Sometimes the simulator fails to load. You will want to stop the command by pressing
${chalk.yellow('ctrl+c')} and running ${chalk.yellow('npm start')} instead.
If the simulator is already open, press the button to try again.

You can also use a real device for testing, https://github.com/react-community/create-react-native-app#npm-run-ios
for more info.`)
  }
  console.log(
    `You can find the docs at ${chalk.blue(
      'https://github.com/viewstools/docs'
    )}`
  )
  getInTouch()
  console.log(`Happy coding! :)`)
}

function unsupported() {
  console.log(
    `It looks like the directory you're on isn't either a create-react-app or create-react-native-app project.`
  )
  console.log(`Is ${chalk.yellow(cwd)} the right folder?\n`)
  console.log(
    `If you don't have a project and want to make a new one, follow these instructions:`
  )
  console.log(`For ${chalk.blue('React DOM')}, ie, a web project:`)
  console.log(
    chalk.green(`npm install --global create-react-app
create-react-app my-app
cd my-app
use-views`)
  )

  console.log(
    `\nFor ${chalk.blue('React Native')}, ie, an iOS or Android project:`
  )
  console.log(
    chalk.green(`npm install --global create-react-native-app
create-react-native-app my-native-app
cd my-native-app
use-views`)
  )

  getInTouch()
}

function getInTouch() {
  console.log(
    `\nIf you need any help, join our Slack community at ${chalk.blue(
      'https://slack.views.tools'
    )}\n`
  )
}

// start
run()

// files
const APP_VIEW = `App Vertical
  alignItems center
  flexBasis auto
  flexGrow 1
  flexShrink 1
  justifyContent center
  Text
    fontSize 18
    text Hello Views Tools!`

const APP_VIEW_LOGIC_DOM = `import App from './App.view.js'
import React from 'react'

let AppLogic = props => {
  return <App {...props} />
}
export default AppLogic`

const APP_VIEW_LOGIC_NATIVE = `import { AppLoading, Font } from 'expo'
import App from './App.view.js'
import fonts from '../../assets/fonts.js'
import React, { useState } from 'react'

let AppLogic = props => {
  let [isReady, setIsReady] = useState(false)

  if (!isReady) {
    return (
      <AppLoading
        startAsync={() => Font.loadAsync(fonts)}
        onFinish={() => setIsReady(true)}
        onError={console.warn}
      />
    );
  }

  return <App {...props} />
}
export default AppLogic`

const APP_NATIVE = `import App from './src/Main/App.view.logic.js'
export default App`

const FONTS_NATIVE = `export default {
// At some point, Views will do this automatically. For now, you
// need to write your fonts by hand. Here's an example of a font used like:
// Text
// fontFamily Robot Mono
// fontWeight 300
// text hey I'm using Roboto Mono!
//
// Font definition:
//
//  'RobotoMono-300': require('./fonts/RobotoMono-300.ttf'),
//
}`

const GITIGNORE = `
# views
**/*.view.js
**/Fonts/*.js`

const VIEWS_CSS = `* {
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: -ms-autohiding-scrollbar;
}
html,
body,
#root {
  height: 100%;
  margin: 0;
}
.views-block, #root {
  align-items: stretch;
  background-color: transparent;
  border-radius: 0;
  border: 0;
  box-sizing: border-box;
  color: inherit;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  font-family: inherit;
  font-size: inherit;
  hyphens: auto;
  line-height: inherit;
  margin: 0;
  outline: 0;
  overflow-wrap: break-word;
  padding: 0;
  position: relative;
  text-align: left;
  text-decoration: none;
  white-space: normal;
  word-wrap: break-word;
}
.views-text {
  box-sizing: border-box;
  hyphens: auto;
  outline: 0;
  overflow-wrap: break-word;
  word-wrap: break-word;
}
.views-capture {
  background-color: transparent;
  box-sizing: border-box;
  border-radius: 0;
  border: 0;
  hyphens: auto;
  outline: 0;
  overflow-wrap: break-word;
  word-wrap: break-word;
}
.views-capture::-moz-focus-inner {
  border: 0;
  margin: 0;
  padding: 0;
}
/* remove number arrows */
.views-capture[type='number']::-webkit-outer-spin-button,
.views-capture[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}`
