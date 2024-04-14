import git, { PromiseFsClient } from 'isomorphic-git'
import http from 'isomorphic-git/http/web' 


const changeLogNoteFilename = 'changelog'
const knownHeadFilename = 'head'
const headFilename = 'headfile'
const corsProxy = 'https://cors.isomorphic-git.org'


export type ListEntry = {
    [key: string]: any; 
    t: string,
    id: string; 
    userId: string;
};

// colaboration bases on the current branch and the filename:
// refs/collab/main/filepath
// it stores the last known head of a file in a file called head 

async function getOid(fs: any, dir: any, ref: string, filePath: string) {
    const fpToOid = await git.walk({
        fs,
        dir,
        trees: [git.TREE({ ref })],
        map: async function(filepath, [refTreeEl]) {
          // ignore directories
          if (filepath !== filePath || !refTreeEl) {
            return
          }
          
          // generate ids
          const fileOid = await refTreeEl.oid()
          
          return {
           [`${filepath}`]: fileOid,
          }
        },
      })

    return (fpToOid as any)[0][filePath] as string;
}

export class AppendOnly extends EventTarget {

    fs: PromiseFsClient;
    ghToken: string  | null;
    folder: string;
    ref: string;
    githubRepoUrl: string;
    filepath: string;
    fileRef: string;

    syncInterval: number;

    currentCommitHash: string;

    private syncedEntries: ListEntry[];
    uncommitedEntiries: ListEntry[];

    baseFileContent: string;
    baseFileOid: string;

    access: 'none' | 'read' | 'write';

    state: 'unknown' | 'fresh' | 'colaboration';

    anonymousUser = true;

    private constructor(fs: PromiseFsClient, ghToken: string | null, folder: string, ref: string, githubRepoUrl: string, filePath: string, fileRef: string, syncInterval: number) {
        super();
        this.fs = fs;
        this.ghToken = ghToken;
        this.folder = folder; 
        this.ref = ref;
        this.filepath = filePath;
        this.fileRef = fileRef;
        this.githubRepoUrl = githubRepoUrl;
        this.syncedEntries = [];
        this.uncommitedEntiries = [];
        this.currentCommitHash = '';
        this.syncInterval = syncInterval;
        this.baseFileContent = '';
        this.baseFileOid = '';
        this.access = 'none';
        this.state = 'unknown'
    }

    static async init(fs: any, ghToken: string | null, folder: string, baseRef: string, githubFilePath: string, init: boolean, syncinterval: number, timeOffset: number) {

        // Extract information from link like:
        // - https://github.com/isomorphic-git/isomorphic-git/blob/main/README.md

        const githubUrlParts = githubFilePath.split('/');

        if (githubUrlParts[2] !== 'github.com' || githubUrlParts[5] !== 'blob') {
            throw new Error('invalid url ' + githubFilePath);
        }

        const githuUrl = githubUrlParts.slice(0, 5).join('/');
        const fileRefOrOid = githubUrlParts[6]
        const filePath = githubUrlParts.slice(7).join('/');

        const appendOnly = new AppendOnly(fs, ghToken, folder, baseRef + fileRefOrOid + '/' + filePath, githuUrl, filePath, fileRefOrOid, syncinterval);

        await new Promise(resolve => setTimeout(resolve, timeOffset));
        
        try {
            await fs.mkdir(appendOnly.folder);

            // TODO checkout only the file :)
            await git.clone({
                fs: appendOnly.fs,
                http,
                dir: appendOnly.folder,
                corsProxy:corsProxy,
                url: appendOnly.githubRepoUrl,
                ref: fileRefOrOid,
                singleBranch: true,
                depth: 1000
            });

        } catch (e) {
            // TODO handle failure -
            console.log('catched')
            console.log(e);
            throw Error("didn't work - no access to clone the repo? " + (e as Error).message)
        }

        appendOnly.baseFileOid = await getOid(appendOnly.fs, appendOnly.folder, fileRefOrOid, filePath);
        if (!appendOnly.baseFileOid) {
            throw new Error("Files oid " + filePath + " not resolved");
        }
        appendOnly.baseFileContent = await fs.readFile(appendOnly.folder +  '/' + filePath, {encoding: 'utf8'});
        
        try {
            // TODO workaround since single branch doesn't seem to work atm
            await git.setConfig({
                fs: appendOnly.fs,
                dir: appendOnly.folder, 
                path: 'remote.origin.fetch',
                value: appendOnly.ref+ ':' + appendOnly.ref,
            })

            console.log('Try fetching existing collaboration state from remote (ref: ' + appendOnly.ref +')')
            const collaborationFetchResult = await git.fetch({
                fs: appendOnly.fs,
                http,
                depth:1000,
                dir: appendOnly.folder, 
                ref: appendOnly.ref,
                remoteRef: appendOnly.ref,
                singleBranch: true,
            })
            appendOnly.currentCommitHash = collaborationFetchResult.fetchHead ?? '';

            console.log('Fetching existing collaboration state from remote - successfull')   
            appendOnly.state = 'colaboration'
        } catch (e) {
            if ((e as any).code !== 'NotFoundError')   {
                throw e;
            }
            appendOnly.state = 'fresh';
        }

        let head: string | undefined = undefined

        
        if (appendOnly.state === 'colaboration') {
            // ok nice we seem to have read access - lets check if there is a head already?
            try {
                console.log('Reading head file')
                head = new TextDecoder().decode(await git.readNote({
                    fs: appendOnly.fs,
                    dir: appendOnly.folder,
                    ref: appendOnly.ref,
                    oid: knownHeadFilename,
                }));
                console.log('Reading head file - sucessfull - head at: '+ head)
    
                
            } catch (e: any) {
                // ok seems like the note does not exist yet
                appendOnly.state = 'unknown';
            }

            console.log('Reading change log file')
            const changeLogNote = await git.readNote({
                fs: appendOnly.fs,
                dir: appendOnly.folder,
                ref: appendOnly.ref,
                oid: changeLogNoteFilename,
            });
            console.log('Reading change log file - sucessfull')


            if (head !== appendOnly.baseFileOid) {
                throw new Error("File " + filePath + " has changed in " + fileRefOrOid +" not support atm");
            }

            console.log('Integration of existing state')
            
            appendOnly.addSyncedFromNote(changeLogNote);
        }
        
        return appendOnly;
    }

    async startSync(userId: string, ghToken?: string) {

        if (ghToken) {
            this.ghToken = ghToken
        }

        this.anonymousUser = false;
        for (const uncommitedEntiry of this.uncommitedEntiries) {
            uncommitedEntiry.userId = userId;
        }

        // TODO pull once again first?

        // try to push the latest state 
        if (this.state === 'fresh') {
            console.log('creating initial note:')
            const head = await git.addNote({
                fs: this.fs,
                dir: this.folder,
                ref: this.ref,
                oid: knownHeadFilename,
                note: this.baseFileOid,
                force: true,
                author: {
                    name: 'test',
                    email: 'test@test.de',
                }
            });
            const noteCommitHash = await git.addNote({
                fs: this.fs,
                dir: this.folder,
                ref: this.ref,
                oid: changeLogNoteFilename,
                note: "",
                force: true,
                author: {
                    name: 'test',
                    email: 'test@test.de',
                }
            });
            console.log('pushing initial note: ')
            await git.push({
                fs: this.fs,
                http,
                corsProxy:corsProxy,
                url: this.githubRepoUrl,
                dir: this.folder,
                ref: this.ref,
                remoteRef: this.ref,
                force: true,
                onAuth: () => {
                    if (!this.ghToken) {
                        return;
                    }
                    return { username: this.ghToken }
                },
            }) 
            console.log('pushing initial note - succesfull:')
            this.currentCommitHash = noteCommitHash;
        }

        return this.doSyncInterVal();
    }

    stopSync() {
        this.ghToken = null;
        this.anonymousUser = true;
    }

    getSyncedEntries<T extends ListEntry>(type: string) { 
        // used to initially fill memory 
        return structuredClone(this.syncedEntries.filter(le => le.t === type)) as unknown as T[]
    }

    add(listEntry: ListEntry) {
        if (this.uncommitedEntiries.find(el => el.id === listEntry.id) || this.syncedEntries.find(el => el.id === listEntry.id)) {
            return;
        }

        this.uncommitedEntiries.push(listEntry);

        this.dispatchEvent(new CustomEvent('uncommittedChanged', { }));

        this.log('current uncommited:');
        console.log(this.uncommitedEntiries);
    }

    private async doSyncInterVal() {
        if (!this.ghToken) {
            return;
        }
        const syncResult = await this.syncEntries();

        setTimeout(() => {
            this.doSyncInterVal();
        }, this.syncInterval)

        return syncResult;
    }

    private addSyncedFromNote(note: Uint8Array) {
        const noteString = new TextDecoder().decode(note);
        this.addSyncedFromNoteString(noteString)
    }

    private addSyncedFromNoteString(note: string) {
        
        const lines = note.split("\n");
        const newEntries = [];
        for (const line of lines) {
            if (line === '') {
                continue;
            }

            const entry = JSON.parse(line) as ListEntry

            if (entry.annotations) {
                for (const annotation of entry.annotations) {
                    if (annotation.currentStart) {
                        console.warn('Annotation with currentStart in transfer file found?', annotation)
                    }
                    delete annotation.currentStart;
                    delete annotation.currentEnd;
                    delete annotation.currentVersions;
                }
            }
           
            if (this.has(entry)) {
                continue
            }

            if (entry)

            newEntries.push(entry);
        }
        // console.log('adding synced states')
        // console.log(newEntries);
        this.addSynced(newEntries);
    }

    private log(o: any) {
        console.log(this.folder + ' ' + JSON.stringify(o));
    }

    private async syncEntries() {
        await git.setConfig({
            fs: this.fs,
            dir: this.folder, 
            path: 'remote.origin.fetch',
            value: this.ref+ ':' + this.ref,
          })

        let syncRunEntries = [...this.uncommitedEntiries]
        
        if (syncRunEntries.length > 0) {
            const note = this.toString();
            this.uncommitedEntiries = [];

            this.dispatchEvent(new CustomEvent('uncommittedChanged', { }));
            
            this.log('found uncommited entries - writing note');
            console.log(note);
            const noteCommit = await git.addNote({  
                fs: this.fs,
                dir: this.folder,
                ref: this.ref,
                oid: changeLogNoteFilename,
                note: note, // contains uncommited and synced entries
                force: true,
                author: {
                    name: 'test',
                    email: 'test@test.de',
                }}
            )
            this.currentCommitHash = noteCommit;
        }
        
    
        try {
            this.log('fetching from remote');
            // fetch - the changes from the collaboration ref
            const fetchResult = await git.fetch({
                fs: this.fs,
                http,
                depth: 1000,
                dir: this.folder, 
                ref: this.ref,
                remoteRef: this.ref,
                singleBranch: true,
            })

            this.log('fetching from remote successfull');
            console.log(fetchResult);

            if (fetchResult.fetchHead === this.currentCommitHash) {
                this.log('No changes! (fetchResult.fetchHead === this.currentCommitHash)');
                return;
            }
    
            // three possible cases: 
            // - merge conflict (commits on the client and on the server) -> add all entries from remote (ignore known) 
            // - no merge conflict -> read current notes and add all entries from remote
            if (this.currentCommitHash !== '') {
                this.log('this.currentCommitHash !== "" - we have created a note before ');
                this.log('Merging Changes changes locally');
                const mergeResult = await git.merge({
                    fs: this.fs,
                    dir: this.folder, 
                    ours: this.currentCommitHash,
                    theirs: fetchResult.fetchHead!,
                    abortOnConflict: false,
                    author: {
                        name: 'test',
                        email: 'test@test.de',
                    },
                    mergeDriver: ({contents}) => {
                        this.log('resolving conflicts')
                        
                        let theirs = contents[2];
                        console.log(theirs);
                        console.log(contents);
                        console.log(this.toStringOf(syncRunEntries))
            
                        const mergedText = theirs + this.toStringOf(syncRunEntries);
            
                        this.addSyncedFromNoteString(theirs);
            
                        return { cleanMerge: true, mergedText }
                    }
                })
        
                this.log('Writing ref to ' + mergeResult.oid + ' current hash ' + this.currentCommitHash)
                await git.writeRef({
                    fs: this.fs,
                    dir: this.folder,
                    ref: this.ref,
                    value: mergeResult.oid!,
                    force: true
                })
                
                if (!mergeResult.mergeCommit) {
                    this.currentCommitHash = mergeResult.oid!;
                    this.log('No merge was needed - only changes from remote')
                    // ok the was no merge needed - we have not been ahead of remote - but remote was ahaead of us - update
                    const note = await git.readNote({
                        fs: this.fs,
                        dir: this.folder,
                        ref: this.ref,
                        oid: changeLogNoteFilename,
                    });
        
                    this.addSyncedFromNote(note);
                }
            } else {
                this.log('We have not yet created any note - but we found notes from remote - update local state')
                this.currentCommitHash = fetchResult.fetchHead!;
                const note = await git.readNote({
                    fs: this.fs,
                    dir: this.folder,
                    ref: this.ref,
                    oid: changeLogNoteFilename,
                });
        
                this.addSyncedFromNote(note);
            }
            
        } catch (e) {
            this.log('error during fetch');
            console.log(e);
        }
        
        try {
            this.log('Pushing changes ' + this.currentCommitHash);
            const pushResult = await git.push({
                fs: this.fs,
                http,
                corsProxy:corsProxy,
                url: this.githubRepoUrl,
                dir: this.folder,
                ref: this.ref,
                remoteRef: this.ref,
                force: true,
                onAuth: () => {
                    if (!this.ghToken) {
                        return;
                    }
                    return { username: this.ghToken }
                },
            }) 
    
            this.log('Push results:')
            console.log(pushResult);
        } catch (e) {
            console.log('jooo');
        }
        
    }

    private addSynced(listEntriesToAdd: ListEntry[]) {

        const listEntriesByType: {[type: string]: ListEntry[]} = {};

        for (const listEntry of listEntriesToAdd) {
            if (!listEntriesByType[listEntry.t]) {
                listEntriesByType[listEntry.t] = [];
            }
            listEntriesByType[listEntry.t].push(listEntry)
            this.syncedEntries.push(listEntry);
        }

        this.dispatchEvent(new CustomEvent('newentries', {
            detail: listEntriesByType
        }));
        return true
    }

    private has(entry: ListEntry) {
        return this.syncedEntries.find(el => el.id === entry.id) !== undefined || this.uncommitedEntiries.find(el => el.id === entry.id);
    } 

    private toStringOf(entries: ListEntry[]) {
        let output = '';
        for (const listEntry of entries) {
            output += '\n' + JSON.stringify(listEntry);
        }

        return output;
    }

    private toString() {
       return this.toStringOf(this.syncedEntries.concat(this.uncommitedEntiries))
    }
    
}