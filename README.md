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
  "return": WHICH_RECORDS_TO_RETURN,    // optional, default: "new, updated"
  "addStatus": ADD_TEXT_STATUS          // optional, default: false
  "statusAttr": STATUS_ATTR_NAME        // optional, default: "status"
  "addChanges": ADD_CHANGE_INFO         // optional, default: false
  "changesAttr": CHANGES_ATTR_NAME      // optional, default: "changes"
  "updatedIf": [                        // optional, column list
    "column_1",
    "column_2",
    ...
  ]
}
```

The __idAttr__ parameter is a name of an attribute of each record, that will be used as it's ID.  
The __return__ parameter can be used to tell the act which records to include in the final result set. Possible values are __new__, __updated__, __deleted__ and __unchanged__, you can provide more than one separated by comma.  
The __addStatus__ parameter sets if the act should add a __status__ attribute to each of the resulting records. If true, it's value will be one of __NEW__, __UPDATED__, __DELETED__ or __UNCHANGED__, depending on the value of __return__ parameter.  
The __statusAttr__ parameter overrides the default __status__ column name, where the status will be stored.  
The __addChanges__ parameter tells the act to include a list of columns that contained changes. This list will be added to a new __changes__ column.  
The __changesAttr__ parameter overrides the default __changes__ column name, where the changes will be stored.  
The __updatedIf__ parameter can contain an array of column names. If set, the record will be recognized as __UPDATED__ if and only if there was a change in one of those columns. If __addChanges__ is set to __true__, the __changes__ array will still contain all the columns names that had changes.

This act can also be run from a __crawler webhook__, in that case the current execution will be compared with directly preceding execution (unless overridden). To use this act from a webhook, use the __Finish webhook data__ in crawler advanced settings to set up the act. 

__Example webhook data:__ 

```javascript
{
  "idAttr": ID_ATTRIBUTE_NAME,
  "return": WHICH_RECORDS_TO_RETURN,
  "addStatus": ADD_TEXT_STATUS,
  "addChanges": ADD_CHANGE_INFO,
  ...
}
```

If you want to compare the current execution with a specific execution (not the one directly preceding), 
you can use __oldExec__ parameter to override.
