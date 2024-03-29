
import { StdioNull } from 'child_process';
import { time } from 'console';
import git, { PromiseFsClient } from 'isomorphic-git'
import http from 'isomorphic-git/http/web' 
import { EntryType } from 'perf_hooks';


const noteFileName = 'changelog'

export type ListEntry = {
    [key: string]: any; 
    t: string,
    id: string; 
};

export class AppendOnly extends EventTarget {

    fs: PromiseFsClient;
    ghToken: string;
    folder: string;
    ref: string;
    githubRepoUrl: string;
    filepath: string;
    fileRef: string;

    syncInterval: number;

    currentCommitHash: string;

    private syncedEntries: ListEntry[];
    uncommitedEntiries: ListEntry[];

    baseFile: string;

    private constructor(fs: PromiseFsClient, ghToken: string, folder: string, ref = 'refs/collab/filepath', githubRepoUrl: string, filePath: string, fileRef: string, syncInterval: number) {
        super();
        this.fs = fs;
        this.ghToken = ghToken;
        this.folder = folder; 
        this.ref = ref;
        this.githubRepoUrl = 
        this.filepath = filePath;
        this.fileRef = fileRef;
        this.githubRepoUrl = githubRepoUrl;
        this.syncedEntries = [];
        this.uncommitedEntiries = [];
        this.currentCommitHash = '';
        this.syncInterval = syncInterval;
        this.baseFile = '';
    }

    static async init(fs: any, ghToken: string, folder: string, baseRef = 'refs/collab/', githubFilePath: string, init: boolean, syncinterval: number, timeOffset: number) {

        // Extract information from link like:
        // - https://github.com/isomorphic-git/isomorphic-git/blob/main/README.md

        debugger;
        const githubUrlParts = githubFilePath.split('/');

        if (githubUrlParts[2] !== 'github.com' || githubUrlParts[5] !== 'blob') {
            throw new Error('invalid url ' + githubFilePath);
        }

        const githuUrl = githubUrlParts.slice(0, 5).join('/');
        const fileRefOrOid = githubUrlParts[6]
        const filePath = githubUrlParts.slice(7).join('/');

        const basePath = githubUrlParts[githubUrlParts.length-1];

        const appendOnly = new AppendOnly(fs, ghToken, folder, baseRef + basePath, githuUrl, filePath, fileRefOrOid, syncinterval);

        appendOnly.log('waiting: '+ timeOffset)
        await new Promise(resolve => setTimeout(resolve, timeOffset));
        appendOnly.log('waiting done: '+ timeOffset)

        try {
            await fs.mkdir(appendOnly.folder);

            // TODO checkout only the file :)
            await git.clone({
                fs: appendOnly.fs,
                http,
                dir: appendOnly.folder,
                corsProxy: 'https://cors.isomorphic-git.org',
                url: appendOnly.githubRepoUrl,
                ref: 'main',
                singleBranch: true,
                depth: 1000
            });

        } catch (e) {
            console.log('catched')
            console.log(e);
        }

        appendOnly.baseFile = await fs.readFile(appendOnly.folder +  '/' + filePath, {encoding: 'utf8'});
        console.log(appendOnly.baseFile);
        
        try {
            // workaround since single branch doesn't seem to work atm
            await git.setConfig({
                fs: appendOnly.fs,
                dir: appendOnly.folder, 
                path: 'remote.origin.fetch',
                value: appendOnly.ref+ ':' + appendOnly.ref,
              })

            console.log('Fetching notes from remote')
            const collaborationFetchResult = await git.fetch({
                fs: appendOnly.fs,
                http,
                depth:1000,
                dir: appendOnly.folder, 
                ref: appendOnly.ref,
                remoteRef: appendOnly.ref,
                singleBranch: true,
            })
            console.log('Fetching notes from remote - successfull')
            
            appendOnly.currentCommitHash = collaborationFetchResult.fetchHead ?? '';

            const note = await git.readNote({
                fs: appendOnly.fs,
                dir: appendOnly.folder,
                ref: appendOnly.ref,
                // TODO use a better oid here - this is the file name of the append only log file
                oid: noteFileName,
            });

            console.log('Integration of existing state')
            
            appendOnly.addSyncedFromNote(note);
            
        } catch (e) {
            // note does not exist yet?
            console.log('note does not exist yet.... ')
            console.log(e)
            if (init) {
                appendOnly.log('creating initial note: '+ timeOffset)
                const note = await git.addNote({
                    fs: appendOnly.fs,
                    dir: appendOnly.folder,
                    ref: appendOnly.ref,
                    oid: noteFileName,
                    note: "",
                    force: true,
                    author: {
                        name: 'test',
                        email: 'test@test.de',
                    }
                });
                appendOnly.log('pushing initial note: '+ timeOffset)
                await git.push({
                    fs: appendOnly.fs,
                    http,
                    corsProxy: 'https://cors.isomorphic-git.org',
                    url: appendOnly.githubRepoUrl,
                    dir: appendOnly.folder,
                    ref: appendOnly.ref,
                    remoteRef: appendOnly.ref,
                    force: true,
                    onAuth: () => {
                        return { username: appendOnly.ghToken }
                    },
                }) 
                appendOnly.log('pushing initial note - succesfull: '+ timeOffset)
                appendOnly.currentCommitHash = note;
            }
            
        }
        
        
        appendOnly.doSyncInterVal();
        

        return appendOnly;
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
        this.log('current uncommited:');
        console.log(this.uncommitedEntiries);
    }

    private async doSyncInterVal() {
        await this.syncEntries();

        setTimeout(() => {
            this.doSyncInterVal();
        }, this.syncInterval)
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
            this.log('found uncommited entries - writing note');
            console.log(note);
            const noteCommit = await git.addNote({  
                fs: this.fs,
                dir: this.folder,
                ref: this.ref,
                oid: noteFileName,
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
                        // theirs
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
                    this.log('No merge was needed - only changes from remot?')
                    // ok the was no merge needed - we have not been ahead of remote - but remote was before us - update
                    const note = await git.readNote({
                        fs: this.fs,
                        dir: this.folder,
                        ref: this.ref,
                        // TODO use a better oid here - this is the file name of the append only log file
                        oid: noteFileName,
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
                    // TODO use a better oid here - this is the file name of the append only log file
                    oid: noteFileName,
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
                corsProxy: 'https://cors.isomorphic-git.org',
                url: this.githubRepoUrl,
                dir: this.folder,
                ref: this.ref,
                remoteRef: this.ref,
                force: true,
                onAuth: () => {
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