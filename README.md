# cht-upgrade-helper

Helper script for reviewing configuration when upgrading the CHT.

## Installation

- Clone this repository
  - `git clone https://github.com/jkuester/cht-upgrade-helper.git`
- Install the utility
  - `npm install --global cht-upgrade-helper`

## Usage

You can run the utility by using the `cht-upgrade-helper` command.

Just running `cht-upgrade-helper` (with no arguments) will output a report for all the forms nested below the current directory. 

Alternatively, the names of the XML files to include in the report can be provided. (e.g. `cht-upgrade-helper forms/app/patient_assessment.xml`)

Output from the cht-upgrade-helper command is formatted with Markdown and can be saved to a file like this:
`cht-upgrade-helper > output.md` 
