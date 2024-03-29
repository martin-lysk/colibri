import React from 'react';
import ReactDOM from 'react-dom/client';

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web' 
import LightningFS from '@isomorphic-git/lightning-fs'

import './index.css';
import App from './App';

function waitThreeSeconds(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 3000); // 3000 milliseconds = 3 seconds
  });
}

// Usag

// @ts-ignore
global.http = http;
// import reportWebVitals from './reportWebVitals';

// @ts-ignore
window.fs = new LightningFS('fs')
// @ts-ignore
window.pfs = window.fs.promises
// @ts-ignore
let pfs = window.pfs;



// TODO add build tool like webpack
// TODO initialize a collaboration session - input box with url
// TODO read the readme markdown
// TODO parse the md using atjson
// TODO create a new sequence using only the text part from atjson as a sequence
// TODO add annotations based on the rest of atjsons infos
          // annotation version - the hash of the version from the file?
// TODO create a new collaboration ref based on the filenamepath + '-collaboration' 
          // 
// TODO create a versions file in the root 


;(async () => {


  // const appendOnly = await AppendOnly.init(pfs, gh_token, '/temp14223', undefined, 'https://github.com/martin-lysk/collaborative-md/blob/main/README.md')

  // appendOnly.add({ id: 'test', test: 'carray'});

  // await waitThreeSeconds();
  // const appendOnly2 = await AppendOnly.init(pfs, gh_token, '/temp22243', undefined, 'https://github.com/martin-lysk/collaborative-md/blob/main/README.md')
  // appendOnly2.add({ id: 'test2', test: 'carray'});

  // // @ts-ignore
  // window.appendOnly2 = appendOnly2;
  // // @ts-ignore
  // window.appendOnly = appendOnly;



})()


const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
