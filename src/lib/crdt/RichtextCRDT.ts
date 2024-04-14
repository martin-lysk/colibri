import Delta from 'quill-delta'
import { sequence_crdt } from "./SequenceCRDT";
import quillDeltaToMdast from './utill/quillDeltaToMdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import {toMarkdown} from 'mdast-util-to-markdown'


import mdToAnotatedSequence from "./utill/MdToAnnotatedSequence";


// const Delta = Quill.import('delta');

export type PersistableVersion = { 
    id: string, 
    userId: string,
    t: 'PersistableVersion',
    parents: string[], 
    splices: any, 
    annotations: SequenceAnnotation[] 
}

export type VersionAdded = {
    readonly type: 'versionAdded';
    readonly version: PersistableVersion;
    readonly source: 'local' | 'remote';
    readonly batchSize: number;
    readonly batchIndex: number; 
};


type SequenceAnnotation = {
    version: string,
    start: number,
    end: number,
    growType: string,
    data: any,

    currentStart?: number,
    currentEnd?: number,
    currentVersions?: string[],
}

export class RichtextCrdt extends EventTarget {

    rootVersion: string;
    versions: { [versionId: string]: string[] | null; };
    annotations: SequenceAnnotation[];
    currentHeadVersions: any[];
    rootNode: any;
    userId: string;
    sessionId: string;
    randomSeed: string;
    currentVersionIndex: number;

    constructor(startSequence: string, userId: string, sessionId: string) {
        super();
        this.rootVersion = 'v_' + 1// + RichtextCrdt.hash(startSequence)
        this.versions = {
            [this.rootVersion]: null,
        }
        const parsedCRDT = mdToAnotatedSequence(startSequence, this.rootVersion);

        this.annotations = [];
        this.userId = userId;

        this.addAnnotationsLocal(this.rootVersion, parsedCRDT.annotations)

        this.currentHeadVersions = [this.rootVersion]

        this.rootNode = sequence_crdt.create_node(this.rootVersion, parsedCRDT.sequence)

        this.sessionId = sessionId;
        this.randomSeed = crypto.randomUUID() + '';
        this.currentVersionIndex = 0;

        
        // fromCrdt(this.getDelta());
    }

    toMdAst() {
        return quillDeltaToMdast(this.getDelta());
    }

    toMd() {
        return toMarkdown(this.toMdAst(), {extensions: [gfmToMarkdown()]});
    }

    setUserId(userId: string) {
        this.userId = userId;
    }

    public dispatch(e: VersionAdded): boolean {
        return this.dispatchEvent(new CustomEvent<VersionAdded>('versionAdded', { detail: e }));
    }

    traverseFrom(version: string, cb: Function, breakOnMultipleParents: boolean) {
        const children = this.findChildren(version) 

        if (children.length > 1 && breakOnMultipleParents) {
            return;
        }

        cb(version);

        let currentChild = 0;

        for (const child of children) {
            this.traverseFrom(child, cb, children.length === currentChild)
            currentChild += 1;
        }
    }

    findChildren(forVersion: string) {
        const children = Object.entries(this.versions).filter(([currentVersion, parentVersion]) => parentVersion && parentVersion.includes(forVersion))
        const childrenVersions = children.map(([version, parentVersion]) => version)
        const sorted = childrenVersions.sort()
        return sorted;
    }

    getDelta() {

        const annotaionById = { }

        const rawSequence = this.getSequence();
 
        const ops = [];
        const textParts = rawSequence.split('\u000b');
        let textPartI = 0;
        for (const textPart of textParts) {
            
            if (textPartI > 0) {
                ops.push({
                    insert: {
                        'LineBreak': true,
                    },
                })
            }
            if (textPart.length > 0) {
                ops.push({
                    insert: textPart.split('\u200b').join(''),
                })
                
            }
            textPartI += 1;
        }

        let sequenceDelta = new Delta(ops);
        
        console.log('getDelta')
        this.traverseFrom(this.rootVersion, (version: string) => {
            for (const annotation of this.annotations) {
                if (annotation.version !== version || annotation.currentStart === undefined || annotation.currentStart === -1) {
                    continue
                }
    
                const annotationDelta = new Delta();
                if (annotation.data.name === 'image') {
                    annotationDelta.retain(annotation.currentStart);
                    annotationDelta.insert({ image: annotation.data.value }, annotation.data.attributes)
                } else if (annotation.data.name === 'break') {
                    annotationDelta.retain(annotation.currentStart);
                    annotationDelta.insert({ break: true})
                } else if (annotation.data.name === 'divider') {
                    annotationDelta.retain(annotation.currentStart);
                    annotationDelta.insert({ divider: true})
                } else {
                    annotationDelta.retain(annotation.currentStart);
                    annotationDelta.retain(annotation.currentEnd! - annotation.currentStart, { [annotation.data.name]: annotation.data.value });
                }
                
                // console.log(JSON.stringify(sequenceDelta))
                // console.log(JSON.stringify(annotationDelta))
                sequenceDelta = sequenceDelta.compose(annotationDelta);
                
                // console.log(JSON.stringify(sequenceDelta))
            }
        }, true);


        return sequenceDelta;
    }
    
    handleDeltaLocal(delta: Delta) {
        
        let currentPosition = 0;
        let numElementstoDelete = 0;
        let elementsToInsert = '';

        const annotationsInVersion: SequenceAnnotation[] = [];

        for (const op of delta.ops) {

            // if ((typeof op.retain === 'number' || typeof op.insert === 'string') && op.attributes) {

            //     if (typeof op.insert === 'string') {
            //         formatDeltas.retain(op.insert!.length, op.attributes));
            //     } else {
            //         formatDelta.retain(op.retain!, op.attributes);
            //     }
                
                // // TODO instead a annotation for every new opp attribute - create a diff of the two deltas and use this to create the annotations
                // for (const [attribute, data] of Object.entries(op.attributes)) {
                //     annotationsInVersion.push({
                //         version: 'placeholderfiller',
                //         start: currentPosition,
                //         end: typeof op.retain === 'number' ? currentPosition + op.retain : currentPosition + (op.insert as string).length,
                //         // TODO map types to grow types - for now this works since we only support no-grow for link
                //         growType: attribute === 'link' ? 'no-grow' : 'grow-right', 
                //         data: {
                //             name: attribute, 
                //             data: data
                //         }
                //     })
                // }
                
            // }

            if (typeof op.retain === 'number') {
                currentPosition += op.retain;
            } 

            if (op.delete) {
                numElementstoDelete += op.delete
            }

            if (typeof op.insert === 'string') {
                elementsToInsert += op.insert;
            } else if (typeof op.insert === 'object') {
                elementsToInsert += '\u000b'; /// image and break
            }

            // [position, num_elements_to_delete, elements_to_insert, optional_sort_key].
            
        }

        const splices = [[currentPosition, numElementstoDelete, elementsToInsert ? elementsToInsert.split('') : []]];
        const currentHead = this.currentHeadVersions;
        
        const localVersion = this.addVersionLocal(splices);

        let currentCRDTState = this.getDelta();
        
        const nullAttributes = {} as any;

        for (const op of currentCRDTState.ops) {
            if (op.attributes) {
                for (const attr of Object.keys(op.attributes)) {
                    nullAttributes[attr] = null;
                }
            }
        }

        const attributesDelta = new Delta();
        for (const op of delta.ops) {

            if ((typeof op.retain === 'number' || typeof op.insert === 'string')) {

                const attributes =  op.attributes ? op.attributes : nullAttributes;
                if (typeof op.insert === 'string') {
                    attributesDelta.retain(op.insert!.length, attributes)
                } else if (typeof op.insert === 'object') {
                    attributesDelta.retain(1, attributes); /// image and break
                } else {
                    attributesDelta.retain(op.retain!, op.attributes)
                }
            }
        }

        let afterEditState = currentCRDTState.compose(attributesDelta)


        if (afterEditState.ops.length > 0) {
            // ok we have a line format at the very last line - make it an insert of \n instead of an remain since we don't have a trailing \n :-/
            // if (afterEditState.ops[afterEditState.ops.length-1].retain === 1) {
            //     delete afterEditState.ops[afterEditState.ops.length-1].retain;
            //     afterEditState.ops[afterEditState.ops.length-1].insert = '\n';
            // }

            const diff1 = currentCRDTState.diff(afterEditState)
            
            let currentPosition = 0;
            for (const op of diff1.ops) {
                if (!op.attributes) {
                    currentPosition += op.retain! as number
                    continue;
                }
                for (const [attribute, data] of Object.entries(op.attributes)) {
                    annotationsInVersion.push({
                        version: localVersion,
                        start: currentPosition,
                        end: typeof op.retain === 'number' ? currentPosition + op.retain : currentPosition + (op.insert as string).length,
                        // TODO map types to grow types - for now this works since we only support no-grow for link
                        // TODO find the beginning of the line and
                        growType: attribute === 'link' ? 'no-grow' : 'grow-right', 
                        data: {
                            name: attribute, 
                            data: data
                        }
                    })
                }
                currentPosition += op.retain! as number
            }
        }
        
        // TODO increase anotaion pointer (not shared)

        this.addAnnotationsLocal(localVersion, annotationsInVersion);

        const annotationsToPush = structuredClone(annotationsInVersion)

        for (const an of annotationsToPush) {
            delete an.currentEnd;
            delete an.currentStart;
        }

        this.dispatch({
            type: 'versionAdded',
            source: 'local',
            batchIndex: 0,
            batchSize: 1,
            version: { id: localVersion, userId: this.userId, t: 'PersistableVersion', parents: currentHead, splices: splices, annotations: annotationsInVersion}
        })
    }

    private addVersionLocal(splices: any) {
        this.currentVersionIndex += 1;
        const newLocalVersion = this.sessionId + '_' + this.randomSeed + '_' +  this.currentVersionIndex;

        const ancestors: any = {}; 
        for (const parent of this.currentHeadVersions) {
            this.getAncestors(parent, ancestors);
            ancestors[parent] = true;
        }

        const rebasedSlices = sequence_crdt.add_version(this.rootNode, newLocalVersion, splices, (version: string) => ancestors[version]);

        this.versions[newLocalVersion] = this.currentHeadVersions
        this.currentHeadVersions = [newLocalVersion];

        // console.log("this.getSequence()");
        // console.log(this.getSequence());
        // console.log(this.annotations);

        this.addSlicesToAnnotations(this.currentHeadVersions, rebasedSlices, this.annotations);

        return newLocalVersion
    }

    // growType grow-right (like bold and formating) no-grow (link)
    private addAnnotationsLocal(version: string, annotations: SequenceAnnotation[]) {
        for (const {start, end, growType, data} of annotations) {
            this.annotations.push({
                version: version,
                start: start,
                end: end, 
                currentStart: start,
                currentEnd: end,
                currentVersions: [version],
                growType: growType,
                data: data
            })
        }
    }

    addSlicesToAnnotations(versions: string[], rebasedSlices: any, annotations: SequenceAnnotation[]) {

        for (const annotation of annotations) {
            
            let currentAnnotationStart = annotation.currentStart !== undefined ? annotation.currentStart : annotation.start;
            let currentAnnotationEnd = annotation.currentEnd !== undefined ?  annotation.currentEnd : annotation.end; 

            if (currentAnnotationStart === -1) {
                continue;
            }

            // splices have the format of [[insert_pos, delete_count, insert_elems, sort_key], ...]
            sliceLoop: for (const [insert_pos, delete_count, insert_elems, sort_key] of rebasedSlices) {


                // offset can be:
                // - positiv - less characters have been deleted than inserted 
                // - negative - more characters have been added than deleted
                const offset = insert_elems.length - delete_count;
                const sliceEnd = insert_pos + delete_count;

                // slices should be ordered by there start postion already... TODO check and assert this
                // lets check if the slice happend before or in the annotation (slices after this annotation are not relevant)

                const maxLength = this.getSequence().length;

                if (insert_pos <= currentAnnotationStart && sliceEnd <= currentAnnotationStart) {
                    // slice starts and ends before the annotation move the annotation to the left or right
                    currentAnnotationStart += offset;
                    currentAnnotationEnd += offset
                    // if (currentAnnotationEnd > maxLength) {
                    //     throw new Error('growed to much');
                    // }

                    console.log('case 1', structuredClone(annotation))
                } else if (insert_pos <= currentAnnotationStart && sliceEnd > currentAnnotationEnd) {
                    // slice overlaps the annotation fully - delete the annotation - since the width of a slice is defined by the deletion of the characters
                    currentAnnotationStart = -1;
                    // deletion cant get undone - no more checks needed
                    console.log('case 2', structuredClone(annotation))
                    break sliceLoop; 
                } else if (insert_pos < currentAnnotationStart && sliceEnd > currentAnnotationStart && sliceEnd <= currentAnnotationEnd) {
                    // slice starts before the annotation but ends in it - remove the overlapping part of the slice from the annotations beginning 
                    console.log('case 3', structuredClone(annotation))
                    currentAnnotationStart = currentAnnotationStart + (delete_count - (currentAnnotationStart - insert_pos));
                } else if (insert_pos == currentAnnotationStart && sliceEnd > currentAnnotationStart && sliceEnd <= currentAnnotationEnd) {
                    // slice starts on the annotation but ends in it - remove the overlapping part of the slice from the annotations beginning 
                    console.log('case 3.1', structuredClone(annotation))
                    currentAnnotationEnd += offset;
                    // if (currentAnnotationEnd > maxLength) {
                    //     throw new Error('growed to much');
                    // }
                } else if (insert_pos > currentAnnotationStart && sliceEnd < currentAnnotationEnd) {
                    // slice starts and ends in an annotation expand or decrease the annotation (in/decreases the end) by its offset
                    console.log('case 4', structuredClone(annotation))
                    console.log('currentAnnotationEnd: ' +currentAnnotationEnd);
                    console.log('addedOffset: ' +offset);
                    currentAnnotationEnd += offset;
                    // if (currentAnnotationEnd > maxLength) {
                    //     throw new Error('growed to much');
                    // }
                } else if (insert_pos > currentAnnotationStart && sliceEnd === currentAnnotationEnd && insert_pos < sliceEnd) {

                
                    // slice starts in an annotation and ends on it expand or decrease the annotation (in/decreases the end) by its offset
                    console.log('case 4', structuredClone(annotation))
                    console.log('currentAnnotationEnd: ' +currentAnnotationEnd);
                    console.log('addedOffset: ' +offset);
                    currentAnnotationEnd += offset;
                    // if (currentAnnotationEnd > maxLength) {
                    //     throw new Error('growed to much');
                    // }
                } else if (insert_pos > currentAnnotationStart && insert_pos < currentAnnotationEnd && sliceEnd > currentAnnotationEnd) {
                    // slices starting in an annotation and ending outside - expand the annotation by the offset
                    console.log('case 5', structuredClone(annotation))
                    currentAnnotationEnd += offset;
                } else if (insert_pos == currentAnnotationEnd) {
                    // slices starting at the end of an annotation depend on the growth methodic
                    if (annotation.growType === 'grow-right') {
                        currentAnnotationEnd += offset;
                        // if (currentAnnotationEnd > maxLength) {
                        //     throw new Error('growed to much');
                        // }
                    } else {
                        // type no-grow not releavnt
                    }
                    console.log('case 6')
                } else if (insert_pos > currentAnnotationEnd) {
                    // slice startin and ending behind the annotation - not relevant
                } else {
                    throw new Error('damn what case did i miss ')
                }
            }


            annotation.currentStart = currentAnnotationStart;
            annotation.currentEnd = currentAnnotationEnd;

            annotation.currentVersions = versions;
        }
    }

    addVersions(versions: PersistableVersion[]) {
        const batchSize = versions.length;
        let batchIndex = 0;
        for (const version of versions) {
            this.addVersion(version, batchIndex, batchSize);
            batchIndex += 1;
        }
    }

    addVersion(version: PersistableVersion, batchIndex: number, batchSize: number) {

        // check that we don't know this version yet
        if (this.versions[version.id] !== undefined) {
            return
            // throw new Error('tried to add an known version')
        }

        // check if we have the parents of the given version
        for (const parent of version.parents) {
            if (this.versions[parent] === undefined) {
                console.warn('tried to add version with an unknown parent ' + parent)
                return;
            }
        }

        // create ancestor map
        const ancestors: any = {}; 
        for (const parent of version.parents) {
            ancestors[parent] = true;
            this.getAncestors(parent, ancestors);
        }
        
        const rebasedSlices = sequence_crdt.add_version(this.rootNode, version.id, version.splices, (version: string) => ancestors[version]);
        this.versions[version.id] = structuredClone(version.parents);
        
        this.currentHeadVersions.push(version.id);
        this.currentHeadVersions = this.currentHeadVersions.filter(versionCandidate => 
            !Object.keys(ancestors).includes(versionCandidate)
        );

        // apply slices to current annotations
        this.addSlicesToAnnotations(this.currentHeadVersions, rebasedSlices, this.annotations);

        // add current version to knownByAnnotation
        const knownByAnnotation = structuredClone(ancestors);
        knownByAnnotation[version.id] = true
        const versionsToPropagateToAnotations = this.generateBraids(knownByAnnotation) as any

        // TODO do i need to calculate the rebase???
        let splicesMissingInAddedAnnotations :any = [];
        for (const versionsToPropagateToAnotation of versionsToPropagateToAnotations) {
            splicesMissingInAddedAnnotations = splicesMissingInAddedAnnotations.concat(versionsToPropagateToAnotation.splices);
        }
        
        this.addSlicesToAnnotations(this.currentHeadVersions, splicesMissingInAddedAnnotations, version.annotations);

        this.annotations = this.annotations.concat(structuredClone(version.annotations));
        
        version.annotations.forEach((a) => {
            delete a.currentEnd;
            delete a.currentStart;
        })
        this.dispatch({
            type: 'versionAdded',
            source: 'remote',
            batchIndex: batchIndex,
            batchSize: batchSize,
            version: version
        })
        
    }

    generateBraids(knownVersions: { [versionId: string]: string[] | null; }) {
        const unknownVersions = structuredClone(this.versions);
        
        for (const knownVersion of Object.keys(knownVersions)) {
            delete unknownVersions[knownVersion];
        }

        // versions and there ancestors in the order we can use to integrate
        const versionsInItegrationOrder = [];
        
        const virtualKnownVersions = structuredClone(knownVersions);

        while (Object.keys(unknownVersions).length > 0) {

            let versionToIntegrateFound = false;

            outerLoop: for (const [unknownVersion, unkonwnVersionsParents] of Object.entries(unknownVersions)) {
                // the root version must allways be non null
                for (const unkonwnVersionsParent of (unkonwnVersionsParents  as any[])!) {
                    if (virtualKnownVersions[unkonwnVersionsParent] === undefined) {
                        // one of the parents is unknown - we cant integrate this version yet
                        continue outerLoop;
                    }
                }

                // the parents of the unknown version are known - it can be integrated
                
                // get ancestors for is ancestor function
                const unkownVersionsAncestors = {} as {[version: string]: boolean}; 
                this.getAncestors(unknownVersion, unkownVersionsAncestors);

                versionsInItegrationOrder.push({ version: unknownVersion, ancestors: unkownVersionsAncestors, parents: unknownVersions[unknownVersion], splices: [] as any[]})
                
                // add to virtual known versions
                virtualKnownVersions[unknownVersion] = unknownVersions[unknownVersion]
                
                // drop the unkown versoin - 
                delete unknownVersions[unknownVersion];
                versionToIntegrateFound = true;
            }

            if (!versionToIntegrateFound) {
                throw Error('Not all versions can be integrated');
            }
        }
        

        for (const versionToIntegrate of versionsInItegrationOrder) {
            versionToIntegrate.splices = sequence_crdt.generate_braid(this.rootNode, versionToIntegrate.version, (version: string) => versionToIntegrate.ancestors[version]);
        }

        return versionsInItegrationOrder;
    }

    getAncestors(version: string, ancestors: {[version: string]: boolean}, tilVersion?: string) {
        
        const currentVersion = this.versions[version];

        if (currentVersion === null || tilVersion === version) {
            return;
        }

        if (currentVersion === undefined) {
            throw new Error('Version does not exist ' + version)
        }

        for (const parentVersion of currentVersion) {
            ancestors[parentVersion] = true;
            this.getAncestors(parentVersion, ancestors)
        }
    }

    // addState()

    // integrateCrdt(sequenceCrdt: RichtextCrdt) {
    //     const versionsToIntegrate = sequenceCrdt.generateBraids(this.versions);

    //     for (const versionToIntegrate of versionsToIntegrate) {
    //         const annotationsToAdd = [];
    //         for (const annotation of sequenceCrdt.annotations) {
    //             if (annotation.version === versionToIntegrate.version) {

    //                 // remove the information from the other crdt - and start from there root version
    //                 const cleanedAnnotation = structuredClone(annotation);

    //                 // for now we clean them later we can use there offset position?
    //                 delete cleanedAnnotation.currentStart;
    //                 delete cleanedAnnotation.currentEnd;
    //                 delete cleanedAnnotation.currentVersions;

    //                 annotationsToAdd.push(cleanedAnnotation);

    //             }
    //         }
    //         // the root version should always exist no need to add here - we can bang the parrents
    //         this.addVersion(versionToIntegrate.version, versionToIntegrate.parents!, versionToIntegrate.splices, annotationsToAdd);

    //     }

    // }

    getSequence() {
        let sequence = ''
        sequence_crdt.traverse(this.rootNode, () => true, (node: any, offset: number) => {
            sequence += node.elems.join ? node.elems.join(''): node.elems;
        });
        return sequence
    }

    getRangeIndex() {

    }

    static hash(sequence: string) {
        let a = 1, c = 0, h, o;
        if (sequence) {
            a = 0;
            /*jshint plusplus:false bitwise:false*/
            for (h = sequence.length - 1; h >= 0; h--) {
                o = sequence.charCodeAt(h);
                a = (a<<6&268435455) + o + (o<<14);
                c = a & 266338304;
                a = c!==0?a^c>>21:a;
            }
        }
        return String(a);
    }
}