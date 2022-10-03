# cht-upgrade-helper

Helper script for reviewing configuration when upgrading the CHT. 

This utility generates a document containing form elements that should be reviewed before using your configuration with a new version of the CHT. (Currently only version `4.0.0` is supported.)

---

## cht-conf

Upgrading to the latest version of [cht-conf](https://github.com/medic/cht-conf) is highly recommended since it also contains many additional validations for your form configurations.

Use the following command to run the `cht-conf` form validations (without uploading the forms to a server).

```shell
cht --url=******* validate-app-forms validate-collect-forms validate-contact-forms
```

---

## `cht-upgrade-helper` Supported Validations

### Forms load without runtime errors

Each form is loaded in a headless Enketo instance and any runtime errors are recorded. 

### Find non-relevant questions with default values

The behavior of default values for non-relevant fields has changed. Previously, if a question with a default value was never relevant, its default value would be used for calculations and other form logic.

Now, however, the value from a non-relevant field will always be empty, regardless of the default value. (Note that because of [this known issue](https://github.com/medic/cht-core/issues/7674) it can appear that the default value is being used while filling out the form. However, when the form it saved, the value will be cleared and all the dependent logic will be recalculated.

So, questions with default values that might be non-relevant, but are used in other form logic should be reviewed and updated if necessary. One potential fix is to add a `calculation` that can be referenced by the form logic instead of the non-relevant question.  The `calculate` can use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function like this: `coalesce(${non_relevant_question}, *original default for non_relevant_question*)`.

### Find non-required number questions

The value used for unanswered number questions in `calculation`s has changed. Previously `0` would be given to the `calculation` logic, but the new version of the CHT follows the [ODK spec](https://docs.getodk.org/form-logic/#empty-values) and returns `NaN` as the value of an unanswered number question.

This behavior change can break form logic that expects `0`. All `calculation`s involving non-required number questions should be reviewed.

One potential fix is to update the `calculation` to use the [coalesce](https://docs.getodk.org/form-operators-functions/#coalesce) function. So, `${potentially_empty_value} > 0` becomes `coalesce(${potentially_empty_value}, 0) > 0`.

See [this issue](https://github.com/medic/cht-core/issues/7222) for more context.

## Installation

- Clone this repository
  - `git clone https://github.com/jkuester/cht-upgrade-helper.git`
- Install the utility
  - `cd cht-upgrade-helper && npm install --global`

## Usage

You can run the utility by using the `cht-upgrade-helper` command in the base directory of your CHT config. (The directory containing the `app-settings.json` file and the `forms` directory.)

Just running `cht-upgrade-helper` (with no arguments) will output a report for all the forms in the config. 

Alternatively, the names of the forms to include in the report can be provided after `--`. (e.g. `cht-upgrade-helper -- pregnancy delivery person-edit`)

Output from the cht-upgrade-helper command is formatted with [Markdown](https://en.wikipedia.org/wiki/Markdown) and can be saved to a file like this:
`cht-upgrade-helper > output.md` 
