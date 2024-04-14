/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import './App.css';
import QuillEditor, { QuillEditorHandle } from './lib/quill/QuillEditor';
import { AppendOnly, ListEntry } from './lib/append-only-file/AppendOnly';
import { RichtextCrdt, VersionAdded, PersistableVersion } from './lib/crdt/RichtextCRDT';
import { useEffect, useRef, useState } from 'react';

// @ts-ignore
import { createNodeishMemoryFs } from '@lix-js/fs'


import 'quill/dist/quill.core.css';
import 'quill/dist/quill.snow.css';


import DiscussionList from './ui/discussion/DiscussionList';
import { EventStore,  DiscussionThread, MaterializedDiscussionThread, DiscussionReply, DiscussionNote, DataEvent } from './lib/crdt/Discussions';

const fs = createNodeishMemoryFs();

const GH_TOKEN_KEY = 'gh_token_temp'

const baseRef = 'refs/collab/alpha4/';

// Parse the URL and get the query parameters
const urlParams = new URLSearchParams(window.location.search);

// Get the value of the "doc" parameter
const docParam = urlParams.get('doc');

const githubFileUrl = docParam;

const discussionStore = new EventStore();

// @ts-ignore
window.eventStore = discussionStore

function App() {

  const [loading, setLoading] = useState(true);
  const [crdt, setCrdt] = useState<RichtextCrdt | undefined>(undefined);
  const [showGithubLogin, setShowGithubLogin] = useState(false);
  const [ghToken, setGhToken] = useState<string | null>(localStorage.getItem(GH_TOKEN_KEY))
  const [githubUserId, setGithubUserId] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string>('ANONYMOUS');
  const [docUrl, setDocUrl] = useState<string | null>(urlParams.get('doc'))
  const [selectedDiscussion, setSelectedDiscussion] = useState<string | null>(null);
  const [disussionTops, setDisussionTops] = useState<{[discussionId: string]: number}>({})
  const [unsyncedEntries, setUnsyncedEntries] = useState(0);
  const [appendOnly, setAppendOnly] = useState<undefined|AppendOnly>(undefined);

  const [githubUserMap, setGithubUserMap] = useState<{[userId: string]: {
    avatar_url: string,
    login: string,    
  }}>({})

  const [discussions, setDiscussions] = useState<MaterializedDiscussionThread[]>([]);
  const [, setForceUpdate] = useState(Date.now());
  
  const [enteredDocUrl, setEnteredDocUrl] = useState('');

  const [token, setToken] = useState('');

  const quillEditorRef = useRef<QuillEditorHandle>(null);

  const loadGithubUser = async (userId: string) => {
    if (githubUserMap[userId]) {
      return githubUserMap
    }

    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    } as any

    if (ghToken) {
      headers['Authorization'] = `Bearer ${ghToken}`;
    }
    
    const response = await fetch('https://api.github.com/user/' + userId, {
        method: 'GET',
        headers: headers
      })
      if (!response.ok) {
        throw new Error('Network response was not ok');
      } 

      const userJson = await response.json();
      
      const updatetedUserMap = structuredClone(githubUserMap);
      updatetedUserMap[userId] = {
        login: userJson.login,
        avatar_url: userJson.avatar_url,
      }
      setGithubUserMap(updatetedUserMap);
  }

  const onDocUrlClick = () => {
    // You can add your logic here for handling the token, such as sending it to a server
    console.log('GitHub url entered:', enteredDocUrl);
    // Reset the input field after submission if needed
    
    setDocUrl(enteredDocUrl);
  };

  const onGithubTokenClick = () => {
    // You can add your logic here for handling the token, such as sending it to a server
    console.log('GitHub token entered:', token);
    // Reset the input field after submission if needed
    localStorage.setItem(GH_TOKEN_KEY, token)
    setGhToken(token);
  };

  useEffect(() => {
    if (ghToken) {
      fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${ghToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => { 
        setUserId(data.id); 
        setGithubUserId(data.id);
        crdt?.setUserId(data.id);
        discussionStore.remote?.startSync(data.id, ghToken);

        loadGithubUser(data.id);
      })
      .catch(error => {
        setGhToken(null);
        console.error('There was a problem with your fetch operation:', error)
      });
    }
  }, [ghToken]) 

  useEffect(() => {

    const updateEvents = () => {
      setDiscussions(DiscussionThread.getAllMaterialized(discussionStore));
    }

    discussionStore.addEventListener('eventAdded', updateEvents);

    return () => {
      discussionStore.removeEventListener('eventAdded', updateEvents);
    }
  }, [])

  useEffect(() => {
    if (docUrl) {
      AppendOnly.init(fs, ghToken, '/folder-for-appendonly', baseRef, docUrl, true, 2000, 1).then(freshAppendOnly => {
        
        const crdt = new RichtextCrdt(freshAppendOnly.baseFileContent, userId ,crypto.randomUUID());
        crdt.addVersions(freshAppendOnly.getSyncedEntries<PersistableVersion>('PersistableVersion'))

        for (const event of freshAppendOnly.getSyncedEntries<DataEvent>('DataEvent')) {
          loadGithubUser(event.userId);
        }
      
        crdt.addEventListener('versionAdded', (e: any) => {
          let event = e.detail as VersionAdded; 
          if (event.source === 'local') {
  
            const version = structuredClone(event.version)
            for (const annotation of version.annotations) {
                delete annotation.currentStart;
                delete annotation.currentEnd;
                delete annotation.currentVersions;
            }
  
            freshAppendOnly.add(version);
          }
        })
  
        freshAppendOnly.addEventListener('uncommittedChanged', (e: any) => {

          setUnsyncedEntries(freshAppendOnly.uncommitedEntiries.length)

        })

        freshAppendOnly.addEventListener('newentries', (e: any) => {

          setUnsyncedEntries(freshAppendOnly.uncommitedEntiries.length)
  
          let listEntriesByType = e.detail as {[type: string]: ListEntry[]}; 

          if (listEntriesByType['DataEvent']) {
            for (const event of listEntriesByType['DataEvent']) {
              loadGithubUser(event.userId);
            }
          }

          if (listEntriesByType['PersistableVersion']) {
            crdt.addVersions(listEntriesByType['PersistableVersion'] as PersistableVersion[]);
          }
        })
  
        setAppendOnly(freshAppendOnly);
        setCrdt(crdt);
        discussionStore.registerRemote(freshAppendOnly);
      });
    }
  }, [docUrl])

  useEffect(()=> {
    if (ghToken && githubUserId) {
      appendOnly?.startSync(githubUserId, ghToken)
    } else {
      appendOnly?.stopSync()
    }
  }, [githubUserId, appendOnly])

  return (
    
    <div className="App">
      { !showGithubLogin && !ghToken && unsyncedEntries > 0 &&  
        <div className='floating-div'>
          Login to sync your suggestions
          <button onClick={() => {setShowGithubLogin(true)}}>
            Sign in
          </button>
        </div>
      }
      { showGithubLogin &&
      <div className="modal-mask">
       <div className="github-token-container">
        <div className="github-token-input-container">
          <label htmlFor="githubToken" className="github-token-label">
            Enter GitHub Token:
          </label>
          <input
            type="text"
            id="githubToken"
            className="github-token-input"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
            }}
          />
          <div>
          <button onClick={() => {setShowGithubLogin(false) }} className="github-token-button">
            Cancel
          </button>
          <button onClick={onGithubTokenClick} className="github-token-button">
            Submit
          </button>
          </div>
        </div>
      </div>
      </div>
      }
      { docUrl == null && 
       <div className="github-token-container">
        <div className="github-token-input-container">
          <label htmlFor="githubToken" className="github-token-label">
            Enter GitHub Url:
          </label>
          <input
            type="text"
            className="github-token-input"
            value={enteredDocUrl}
            onChange={(event) => {
              setEnteredDocUrl(event.target.value);
            }}
          />
          <button onClick={onDocUrlClick} className="github-token-button">
            Open
          </button>
        </div>
      </div>
      }
      { !showGithubLogin && crdt === undefined && docUrl !== null &&
        <div>LOADING....</div>
      }
      { crdt &&
      <>
      <div className="toolbar-container">
        <div className="toolbar-left">
        </div>
        <div className="toolbar-center" id="toolbar-container">


          {/* <span >
            <button className="ql-table-add">+table</button>
            <button className="ql-table-insert-row-above">^+row</button>
            <button className="ql-table-insert-row-below">v+row</button>
            <button className="ql-table-insert-column-left">&lt;+column</button>
            <button className="ql-table-insert-column-right">&gt;+column</button>
            <button className="ql-table-delete-table">-table</button>
            <button className="ql-table-delete-row">-row</button>
            <button className="ql-table-delete-column">-column</button>
          </span> */}
          <span className="ql-formats">
            {/* <select className="ql-font"></select> */}
            {/* <select className="ql-size"></select> */}
            <select className="ql-header" ></select>
          </span>
          <span className="ql-formats">
            <button className="ql-bold"></button>
            <button className="ql-italic"></button>
            <button className="ql-underline"></button>
            <button className="ql-strike"></button>
          </span>
          <span className="ql-formats">
            <button className="ql-divider"></button>
            <button className="ql-link"></button>
            <button className="ql-discussion"></button>
            <button className="ql-image"></button>
          </span>
          <span className="ql-formats">
            <select className="ql-align"></select>
            <button className="ql-list" value="check"></button>
            <button className="ql-list" value="ordered"></button>
            <button className="ql-list" value="bullet"></button>
            <button className="ql-clean"></button>
            {/* <select className="ql-color"></select>
            <select className="ql-background"></select> */}
          </span>
          {/* <span className="ql-formats">
            <button className="ql-script" value="sub"></button>
            <button className="ql-script" value="super"></button>
          </span> */}
          <span className="ql-formats">
            <button className="ql-blockquote"></button>
            <button className="ql-code-block"></button>
          </span>
          <span className="ql-formats">
            <button className="ql-list" value="ordered"></button>
            <button className="ql-list" value="bullet"></button>
            {/* <button className="ql-indent" value="-1"></button>
            <button className="ql-indent" value="+1"></button> */}
          </span>
          {/* <span className="ql-formats">
            <button className="ql-direction" value="rtl"></button>
            
          </span> */}
          {/* <span className="ql-formats">
            
            
            <button className="ql-video"></button>
            <button className="ql-formula"></button>
          </span> */}
          <span className="ql-formats">
            <button className="ql-clean"></button>
          </span>
        </div>
       

          <div className="toolbar-right">
            <div className="current-user">
            { !ghToken && (
              <button onClick={() => {setShowGithubLogin(true)}}>
                Sign in
              </button>
            )}
            { ghToken && (
              <img src={githubUserMap[userId] ? githubUserMap[userId].avatar_url : 'loading'} onClick={() => {
                // eslint-disable-next-line no-restricted-globals
                if (confirm('do you want to logout?')) {

                  localStorage.removeItem(GH_TOKEN_KEY)
                  setGhToken(null);
                  setGithubUserId(undefined)
                }
              }}/>
            )}
            </div>
           
          </div>
        </div>

        <div className='content-container'>
          <div className="container">
            <div className="left"></div>
            <div className="center">
              <QuillEditor 
                ref={quillEditorRef}
                onAddDiscussionComment={(discussionId) => {
                  const discussion = {
                    id: discussionId,
                    type: 'd' as 'd',
                    resolvedBy: undefined,
                    deletedBy: undefined,
                    authorId: 'JohnDoe',
                  };

                  // TODO de anonymize comments when github token is set
                  DiscussionThread.create(discussionStore, discussionId, userId);
                  setSelectedDiscussion(discussionId)
                  setForceUpdate(Date.now);
                }}
                onDiscussionHightlightChange={(discussionHighlight) => {
                  setSelectedDiscussion(discussionHighlight)
                }}
                onDiscussionTopPositionsChange={(tops: {[threadId: string]: number})=>{
                  setDisussionTops(tops);
                }}
                richtextCRDT={crdt}
                discussions={discussions}
                
                ></QuillEditor>
            </div>
            <div className="right">
              <DiscussionList 
                disussionTops={disussionTops}
                onActivate={(id) => { setSelectedDiscussion(id)}}
                discussions={discussions} 
                userMap={githubUserMap}
                selected={selectedDiscussion}
                onDelete={function (discussionId: string): void {
                  quillEditorRef.current?.deleteId(discussionId);
                  
                  DiscussionNote.delete(discussionStore, discussionId, userId);
                  setForceUpdate(Date.now());
                  // discussions.current = discussions.current.filter(p => p.id !== discussionId);
                } } 
                onComment={function (discussionId: string, commentText: string): void {
                  const discussionThreadToUpdate = discussions.find(p => p.entityId === discussionId);
                  if (!discussionThreadToUpdate) {
                    return;
                  }
                  
                  if (!discussionThreadToUpdate.note) {
                    quillEditorRef.current?.createDiscussion(discussionId, commentText);
                    DiscussionThread.updateDiscussionThread(discussionStore, discussionId, userId, { note: commentText, reactions: {} })

                  } else {
                    // add comment insteat
                    DiscussionReply.create(discussionStore, discussionId, userId, Math.random()+ "", commentText)
                    // quillEditorRef.current?.createComment(discussionId, commentText);
                  }
                  // setForceUpdate(Date.now());  
                } } 
                onReaction={function (id: string, reaction: string, untoggle: boolean): void {
                  quillEditorRef.current?.reactTo(id,reaction, untoggle);
                } }
                onResolve={function (discussionId: string): void {
                  quillEditorRef.current?.resolveById(discussionId);
                } } 
                 />
            </div>
          </div>
        </div>
        
        </>
      }
    </div>
  );
}

export default App;
