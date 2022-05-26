# cht-upgrade-helper

Helper script for reviewing configuration when upgrading the CHT.

## Installation

- Clone this repository
  - `git clone https://github.com/jkuester/cht-upgrade-helper.git`
- Install the utility
  - `npm install --global cht-upgrade-helper`

## Usage

You can run the utility by using the `cht-upgrade-helper` command in the base directory of your CHT config. (The directory containing the `app-settings.json` file and the `forms` directory.)

Just running `cht-upgrade-helper` (with no arguments) will output a report for all the forms in the config. 

Alternatively, the names of the forms to include in the report can be provided after `--`. (e.g. `cht-upgrade-helper -- pregnancy delivery person-edit`)

Output from the cht-upgrade-helper command is formatted with [Markdown](https://en.wikipedia.org/wiki/Markdown) and can be saved to a file like this:
`cht-upgrade-helper > output.md` 
