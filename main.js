const Apify = require('apify');
const _ = require('underscore');
const Promise = require('bluebird');

function createKey(result, idAttr){
    return result ? (
        Array.isArray(idAttr) ? 
        idAttr.map(ida => result[ida]).join('_') : 
        result[idAttr]
    ) : null;
}

async function loadResults(execId, process){
    const limit = 15000;
    let total = -1, offset = 0;
    while(total === -1 || offset < total){
        const lastResults = await Apify.client.crawlers.getExecutionResults({
            executionId: execId, 
            limit: limit, 
            offset: offset,
            simplified: 1
        });
        await process(lastResults);
        total = lastResults.total;
        offset += limit;
    }
}

async function createCompareMap(oldExecId, idAttr){
    const data = {};
    let processed = 0;
    console.log('creating comparing map');
    await loadResults(oldExecId, async (fullResults) => {
        const results = _.chain(fullResults.items).flatten().value();
        _.each(results, (result, index) => {
            const key = createKey(result, idAttr);
            if(key){data[key] = result;}
        });
        processed += results.length;
        console.log('processed old results: ' + processed);
    });
    console.log('comparing map created');
    return data;
}

async function compareResults(newExecId, compareMap, idAttr, settings){
    let data = [];
    let processed = 0, pushData = null;
    let newCount = 0, updCount = 0, delCount = 0, uncCount = 0, index = 0;
    
    if(settings.useDataset){
        pushData = (value, flush) => {
            if(!flush){data.push(value);}
            if(data.length >= 100 || flush){
                Apify.pushData(data);
                data = [];
            }
        };
    }
    else{pushData = async value => data.push(value);}
    
    console.log('comparing results');
    await loadResults(newExecId, async (fullResults) => {
        const results = _.chain(fullResults.items).flatten().value();
        for(const result of results){
            const id = createKey(result, idAttr);
            if(id){
                const oldResult = compareMap ? compareMap[id] : null;
                if(!oldResult){
                    if(settings.addStatus){result[settings.statusAttr] = 'NEW';}
                    if(settings.returnNew){await pushData(result);}//data.push(result);}
                    newCount++;
                }
                else if(!_.isEqual(result, oldResult)){
                    const addUpdated = async function(changes){
                        if(settings.addStatus){result[settings.statusAttr] = 'UPDATED';}
                        if(settings.returnUpd){
                            if(settings.addChanges){
                                const tChanges = changes || getChangeAttributes(oldResult, result);
                                result[settings.changesAttr] = settings.stringifyChanges ? tChanges.join(', ') : tChanges;
                            }
                            await pushData(result);//data.push(result);
                        }
                        updCount++;
                    }
                    if(settings.updatedIf){
                        const changes = getChangeAttributes(oldResult, result);
                        const intersection = _.intersection(settings.updatedIf, changes);
                        if(!intersection.length){
                            if(settings.addStatus){result[settings.statusAttr] = 'UNCHANGED';}
                            if(settings.returnUnc){await pushData(result);}//data.push(result);}
                            uncCount++;
                        }
                        else{await addUpdated(intersection);}
                    }
                    else{await addUpdated();}
                }
                else{
                    if(settings.addStatus){result[settings.statusAttr] = 'UNCHANGED';}
                    if(settings.returnUnc){await pushData(result);}//data.push(result);}
                    uncCount++;
                }
                if(compareMap){delete compareMap[id];}
            }
            else{console.log('record is missing id (' + idAttr + '): ' + JSON.stringify(result));}
        }
        processed += results.length;
        console.log('compared new results: ' + processed);
    });
    console.log('comparing results finished');
    
    if(compareMap && settings.returnDel){
        console.log('processing deleted results');
        const values = Object.values(compareMap);
        for(const oldResult of values){
            if(settings.addStatus){oldResult[settings.statusAttr] = 'DELETED';}
            await pushData(oldResult);//data.push(oldResult);
            delCount++;
        }
        console.log('processing deleted results finished');
    }
    
    console.log('new: ' + newCount + ', updated: ' + updCount + 
                (settings.returnDel ? (', deleted: ' + delCount) : '') + 
                ', unchanged: ' + uncCount);
    if(!settings.useDataset){return data;}
    else{pushData(null, true);}
}

async function getPreviousExecId(crawlerId, lastExecId){
    const list = await Apify.client.crawlers.getListOfExecutions({crawlerId, desc: 1});
    const lastExecIndex = _.findIndex(list.items, (item) => item._id == lastExecId);
    if(lastExecIndex > -1 && list.items.length > lastExecIndex + 1){
        return list.items[lastExecIndex + 1]._id;
    }
    return null;
}

function getChangeAttributes(obj1, obj2, prefix, out){
    const changes = out ? out : [];
    if(obj1){
        for(const key in obj1){
            const v1 = obj1[key];
            const v2 = obj2 ? obj2[key] : null;
            if(!_.isEqual(v1, v2)){
                if(v1 !== null && typeof v1 === 'object'){
                    getChangeAttributes(v1, v2, key + '/', changes);
                }
                else{changes.push(prefix ? prefix + key : key);}
            }
        }
    }
    return changes;
}

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');
    
    const data = input.data ? (typeof input.data === 'string' ? JSON.parse(input.data) : input.data) : input;
    if(!data.idAttr){
        return console.log('missing "idAttr" attribute in INPUT');
    }
    if(!input._id){
        if(!data.oldExec){
            return console.log('missing "oldExec" attribute in INPUT');
        }
        if(!data.newExec){
            return console.log('missing "newExec" attribute in INPUT');
        }
    }
    else if(!data.oldExec){
        data.oldExec = await getPreviousExecId(input.actId, input._id);
        /*if(!data.oldExec){
            return console.log('previous execution not found');
        }*/
    }
    
    if(data.token){Apify.client.setOptions({token: data.token});}
    if(data.userId){Apify.client.setOptions({userId: data.userId});}
    
    const settings = {};
    data.return = data.return || 'new, updated';
    settings.returnNew = data.return.match(/new/i);
    settings.returnUpd = data.return.match(/updated/i);
    settings.returnDel = data.return.match(/deleted/i);
    settings.returnUnc = data.return.match(/unchanged/i);
    settings.addStatus = data.addStatus ? true : false;
    settings.addChanges = data.addChanges ? true : false;
    settings.statusAttr = data.statusAttr ? data.statusAttr : 'status';
    settings.changesAttr = data.changesAttr ? data.changesAttr : 'changes';
    settings.stringifyChanges = data.stringifyChanges;
    settings.updatedIf = data.updatedIf;
    settings.useDataset = data.useDataset;
    
    const compareMap = data.oldExec ? (await createCompareMap(data.oldExec, data.idAttr)) : null;
    const resultData = await compareResults(input._id || data.newExec, compareMap, data.idAttr, settings);
    
    if(resultData){await Apify.setValue('OUTPUT', resultData);}
    console.log('finished');
});
