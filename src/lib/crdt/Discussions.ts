import { AppendOnly, ListEntry } from "../append-only-file/AppendOnly";


export class EventStore extends EventTarget {
    
    localOnlyEvents: DataEvent[] = []
    
    events: DataEvent[] = []
    
    remote: AppendOnly | undefined

    localOnly: {
        [entityId: string]: boolean,
    } = {};

    registerRemote(appendOnly: AppendOnly) {
        appendOnly.addEventListener('newentries', (e: any) => {
            let listEntriesByType = e.detail as {[type: string]: ListEntry[]}; 
            if (listEntriesByType['DataEvent']) {
                for (const dataEvent of listEntriesByType['DataEvent'] as DataEvent[]) {
                    this.addToEventList(dataEvent);
                }
                return this.dispatchEvent(new CustomEvent<any>('eventAdded', { }));
            }
        });

        for (const remoteEvent of appendOnly.getSyncedEntries<DataEvent>('DataEvent')) {
            this.addToEventList(remoteEvent);
        }
        this.remote = appendOnly 

        this.synchronizeLocalEvents();
        return this.dispatchEvent(new CustomEvent<any>('eventAdded', { }));
    }

    synchronizeLocalEvents() {
        if (!this.remote) {
            return;
        }

        const stillLocal = [];

        for (const localEvent of this.localOnlyEvents) {
            if (!this.localOnly[localEvent.entityId]) {
                this.remote.add(localEvent);
            } else {
                stillLocal.push(localEvent);
            }
        }

        this.localOnlyEvents = stillLocal;
    }
    
    startSyncEntity(entityId: string) {
        delete this.localOnly[entityId];
        
        this.synchronizeLocalEvents()
    }

    private addToEventList(event: DataEvent) {
        if (this.events.find(e => e.id === event.id)) {
            return;
        }
        this.events.push(event);
    }

    addEvent(event: DataEvent, local: boolean = false) {
        if (local) {
            this.localOnly[event.entityId] = true;
        }
        this.addToEventList(event);
        if (this.remote && !this.localOnly[event.entityId]) {
            this.remote.add(event);
        } else {
            this.localOnlyEvents.push(event);
        }
        return this.dispatchEvent(new CustomEvent<any>('eventAdded', { }));
    }

    getEventsForType(entityType: string) {
        return this.events.filter(e => e.entityType === entityType);
    }

    getEventsForEntity(entityId: string) {
        return this.events.filter(e => e.entityId === entityId);
    }

    getEventsByFilterFn(filterFn: (e: DataEvent) => boolean) {
        return this.events.filter(filterFn);
    }
    
}

export type DataEvent = {
    id: string,
    t: 'DataEvent',
    eventType: 'init' | 'create' | 'update' | 'delete',
    entityType: string,
    entityId: string, 
    date: number, 
    data: any,
    userId: string, 
}

export class DiscussionNote {

    entityId: string;
    
    constructor(entityId: string) {
        this.entityId = entityId;
    }

    getNote(eventStore: EventStore) {
        return this.getNoteEvent(eventStore)?.data.note;
    }

    private getNoteFirstEvent(eventStore: EventStore) {
        return eventStore.getEventsByFilterFn((e) => e.entityId === this.entityId && (e.eventType === 'init' || e.eventType === 'create') ).pop()
    }



    private getNoteEvent(eventStore: EventStore) {
        return eventStore.getEventsByFilterFn((e) => e.entityId === this.entityId && e.data.note !== undefined).pop()
    }

    private getDeletionEvent(eventStore: EventStore) {
        return eventStore.getEventsByFilterFn((e) => e.entityId === this.entityId && e.eventType === 'delete').pop()
    }
    
    static update(eventStore: EventStore, entityType: string, entityId: string, userId: string, data: { note?: string, reactions: { [reaction: string]: boolean} } & Partial<{ [key: string]: any }>, date: Date = new Date()) {
        const updatedAt = date.getTime();
        eventStore.addEvent({
            id: 'e_' + crypto.randomUUID(),
            t: 'DataEvent',
            eventType: 'update',
            entityType: entityType,
            entityId: entityId,
            data: data,
            date: updatedAt,
            userId: userId,
        })
    }

    static delete(eventStore: EventStore, entityId: string, userId: string, date: Date = new Date()) {
        const deletedAt = date.getTime();
        eventStore.addEvent({
            t: 'DataEvent',
            id: 'e_' + crypto.randomUUID(),
            eventType: 'delete',
            entityType: DiscussionThread.entityType,
            entityId: entityId,
            data: {},
            date: deletedAt,
            userId: userId,
        })
    }

    // TODO add this for reactions
    // getReactions(eventStore: EventStore) {
    //     return this.getReactionsEvents(eventStore)?.data.note;
    // }

    // private getReactions(eventStore: EventStore) {
    //     const reactionEvents = eventStore.getEventsByFilterFn((e) => e.entityId === this.entityId && e.data.reaction !== undefined);

    //     const reactions: {
    //         [userId: string]: {
    //             [reaction: string]: Date | null,
    //         }
    //     } = {};

    //     for (const reactionEvent of reactionEvents) {
    //         if (reactions[reactionEvent.userId)
    //     }
    // }

    // commentDiscussion(discussionId: string, commentText: string) {
    //     const comment: DiscussionComment = {
    //         type: 'c',
    //         id: 'id' + getId(),
    //         discussionId: discussionId,
    //         createdAt: new Date().getTime(),
    //         authorId: this.userId,
    //         comment: commentText,
    //     }
    //     // this.appendOnlyLog.push(appendOnly)
    //     this.comments[comment.id] = comment
    // }

    // toggleReaction(entryId: string, reactionEmoticon: string, untoggle: boolean) {
    //     const reaction: Reaction = {
    //         type: 'r',
    //         id: 'id' + getId(),
    //         entryId: entryId,
    //         createdAt: new Date().getTime(),
    //         authorId: this.userId,
    //         reaction: reactionEmoticon,
    //         untoggle: untoggle,
    //     }

    //     // this.appendOnlyLog.push(appendOnly)
    //     if (this.reactions[entryId]!) {
    //         this.reactions[entryId] = [];
    //     }

    //     this.reactions[entryId].push(reaction);
    // }

    
    materializeCurrentState(eventStore: EventStore) {
        // TODO fetch creation event 
        const noteInitEvent = this.getNoteFirstEvent(eventStore)!;
        const noteEvent = this.getNoteEvent(eventStore);
        const deletionEvent = this.getDeletionEvent(eventStore);
        return {
            entityId: this.entityId,
            createdAt: new Date(noteInitEvent.date),
            createdBy: noteInitEvent.userId,
            note: noteEvent?.data.note,
            noteUpdatedAt: noteEvent?.date ? new Date(noteEvent.date) : undefined,
            deletedAt: deletionEvent?.date ? new Date(deletionEvent.date) : undefined,
            deletedBy: deletionEvent?.userId,
        }
    }
}

export interface MaterializedDiscussionNote {
    entityId: string,
    createdAt: Date,
    createdBy: string,
    note?: string,
    // TODO add noteCreatedAt (not the created event)
    noteUpdatedAt?: Date,
}


export class DiscussionThread extends DiscussionNote {
    static readonly entityType = 'DiscussionThread'

    static create(eventStore: EventStore, entityId: string, userId: string, date: Date = new Date()) {
        const createdAt = date.getTime();
        eventStore.addEvent({
            id: 'e_' + crypto.randomUUID(),
            t: 'DataEvent',
            eventType: 'init',
            entityType: DiscussionThread.entityType,
            entityId: entityId,
            data: {
            }, 
            date: createdAt,
            userId: userId,
        }, true)
    }

    
    static updateDiscussionThread(eventStore: EventStore, entityId: string, userId: string, data: { resolve?: boolean, note?: string, reactions: { [reaction: string]: boolean} }, date: Date = new Date()) {
        super.update(eventStore, DiscussionThread.entityType, entityId, userId, data, date);
        if (data.note) {
            // TODO the note is ready to  sync eventStore.remoteLocalOnlyFlat(enitityId)
            eventStore.startSyncEntity(entityId);
        }
    }

    static getAllMaterialized(eventStore: EventStore) {
        const materialized : MaterializedDiscussionThread[] = [];
        for (const event of eventStore.getEventsByFilterFn((e) => e.entityType === DiscussionThread.entityType && e.eventType === 'init')) {
            const materializedDiscssion = new DiscussionThread(event.entityId).materializeDiscussionThread(eventStore)
            // if (!materializedDiscssion.deletedAt) {
                materialized.push(materializedDiscssion);
            // }
        }
        return materialized;
    }

    private getResolveEvent(eventStore: EventStore) {
        return eventStore.getEventsByFilterFn((e) => e.entityId === this.entityId && e.data.resolved !== undefined).pop()
    }

    private getReplyEvents(eventStore: EventStore) {
        const replyCreationEvents = eventStore.getEventsByFilterFn((e) => e.entityType === DiscussionReply.entityType && e.data.threadId === this.entityId && e.eventType === 'create')
        
        const replies: DiscussionReply[] = [];
        for (const replyCreationEvent of replyCreationEvents) {
            replies.push(
                new DiscussionReply(this.entityId, replyCreationEvent.entityId)
            );
        }
        return replies;
    }

    materializeDiscussionThread(eventStore: EventStore): MaterializedDiscussionThread {
        const resolveEvent = this.getResolveEvent(eventStore);
        return {
            ...super.materializeCurrentState(eventStore),
            resolved: resolveEvent?.data.resolved,
            resolvedToggledAt: resolveEvent?.date,
            resolvedToggledBy: resolveEvent?.userId,
            replies: this.getReplyEvents(eventStore).map(reply => reply.materializeDiscussionReply(eventStore)) as MaterializedDiscussionReply[]
        }
    }
}

export type MaterializedDiscussionThread = {
    entityId: string,
    createdAt: Date,
    createdBy: string,
    note?: string,
    resolved?: boolean
    resolvedToggledAt?: number,
    resolvedToggledBy?: string,
    replies: MaterializedDiscussionNote[],
    deletedAt?: Date,
    deletedBy?: string,

} & MaterializedDiscussionNote


export class DiscussionReply extends DiscussionNote {
    static readonly entityType = 'DiscussionReply'

    threadId: string;

    constructor(threadId: string, entityId: string) {
        super(entityId)
        this.threadId = threadId;
    }

    static create(eventStore: EventStore, threadId: string, userId: string, entityId: string, note: string, date: Date = new Date()) {
        const createdAt = date.getTime();
        eventStore.addEvent({
            id: 'e_' + crypto.randomUUID(),
            t: 'DataEvent',
            eventType: 'create',
            entityType: DiscussionReply.entityType,
            entityId: entityId,
            data: {
                threadId: threadId,
                note: note
            }, 
            date: createdAt,
            userId: userId,
        })
    }


    static updateDiscussionReply(eventStore: EventStore, entityId: string, userId: string, data: { note?: string, reactions: { [reaction: string]: boolean} }, date: Date = new Date()) {
        super.update(eventStore, DiscussionReply.entityType, entityId, userId, data, date);
    }

    materializeDiscussionReply(eventStore: EventStore) {
        return { ...super.materializeCurrentState(eventStore), threadId: this.threadId }
    }
}

export type MaterializedDiscussionReply = {
    entityId: string,
    threadId: string,
    createdAt: Date,
    createdBy: string,
    note?: string,
    deletedAt?: Date,
    deletedBy?: string,
} & MaterializedDiscussionNote
