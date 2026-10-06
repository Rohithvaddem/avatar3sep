import {getUser, login, logout, verifyRequestOrigin} from '@netlify/identity';
import {getStore} from '@netlify/blobs';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../../server/staff-core.mjs';
const files={avatar1:'avatar1_data.json',avatar2:'avatar2_digi/data.json',avatar3:'avatar3_data.json'};
export default createHandler({getUser,login,logout,verifyRequestOrigin,
  store:()=>getStore({name:'staff-plots',consistency:'strong'}),
  seed:async project=>JSON.parse(await readFile(files[project],'utf8'))
});
