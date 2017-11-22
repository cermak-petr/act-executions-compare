# act-executions-compare
Apify act for comparing crawler execution results

This act fetches results from two crawler executions ("old" and "new"), 
compares them and creates a new result set based on the act settings.
By default the final result set will contain only new and updated records.

**INPUT**

Input is a JSON object with the following properties:

```javascript
{
  "oldExec": OLD_EXECUTION_ID,
  "newExec": NEW_EXECUTION_ID,
  "idAttr": ID_ATTRIBUTE_NAME,
  "return": WHICH_RECORDS_TO_RETURN,    // default: "new, updated"
  "addStatus": ADD_TEXT_STATUS          // default: false
}
```

The __idAttr__ parameter is a name of an attribute of each record, that will be used as it's ID.
The __return__ parameter can be used to tell the act which records to include in the final result set.
Possible values are __new__, __updated__, __deleted__ and __unchanged__, you can provide more than one separated by comma.
The __addStatus__ parameter sets if the act should add a __status__ attribute to each of the resulting records.
If true, it's value will be one of __NEW__, __UPDATED__, __DELETED__ or __UNCHANGED__, depending on the value of __return__ parameter.

This act can also be run from a __crawler webhook__, in that case the current execution will be compared with directly preceding execution (unless overridden). To use this act from a webhook, use the __Finish webhook data__ in crawler advanced settings to set up the act. 

__Example webhook data:__ 

```javascript
{
  "idAttr": ID_ATTRIBUTE_NAME,
  "return": WHICH_RECORDS_TO_RETURN,    // default: "new, updated"
  "addStatus": ADD_TEXT_STATUS          // default: false
}
```

If you want to compare the current execution with a specific execution (not the one directly preceding), 
you can use __oldExec__ parameter to override.
