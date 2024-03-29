import { Delta } from "quill/core";
import { sequence_crdt } from "./SequenceCRDT";
import Quill from "quill"
import { AnyCnameRecord } from "dns";
import quillDeltaToMdast from './quillDeltaToMdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import {toMarkdown} from 'mdast-util-to-markdown'


import {remark} from 'remark'
import remarkGfm from 'remark-gfm'


// const Delta = Quill.import('delta');

export type PersistableVersion = { 
    id: string, 
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

function fromCrdt(delta: Delta) {

    const ast = quillDeltaToMdast(delta);
    
    const md = toMarkdown(ast, {extensions: [gfmToMarkdown()]});

    // console.log(md);

    // let lineOps = [];

    // // headings do not span over the whole line in the deltas - they are attached to the end
    // for (const op of delta.ops) {
    //     if (!op.insert) {
    //         throw new Error('delta is not a document');
    //     }

    //     if (op.insert === '\n') {
    //         if (op.attributes?.header) {
    //             // TODO add attribute to previous line and ignore this op
    //         }

    //         // TODO check if need to do this for other formats as well 
    //     } else {
    //         const lineOps = op.insert!.split('\n');

    //         if (lineOps.length === 1) {
    //             // no new line - just add the op 
    //             lineOps
    //         } else {
    //             let lineOpIndex = 0;
    //         for (const lineOp of lineOps) {
    //             lineOps.push()
    //             lineOpIndex ++;
    //         }
    //         }
            
    //     }
    //     const lineOps = op.insert!.split('\n');
    //     for (const lineOp of lineOps) {
    //         lineOps.push()
    //     }
    // }

    // @ts-ignore
    window.wentthough = md;
    
} 

function toCrdt(document: string, version: string) {
    // let documentTokens = CommonMarkSource.fromRaw(document).convertTo(
    //     OffsetSource
    //   );&&&NEWLINE&&&

    const returnSpaceMarker = '[$&return-space-marker&$]';
    const newLineHelperMarker = '[$&new-line-helper-marker&$]';
    const zeroWidthSpace = 'X' // '\u200b';

    // replace [^\n]\n\n with '\n' - real enter in quill (one offset)
    const preparedDocument = document
    // const preparedDocument = document.replace(/\n{2,}/g, (match, group, offset) => {
    //     // '\n\n\n' <- length = 3 <- 
    //     const crSpaces = match.length - 2;
        
    //     // we add a marker "[$&return-spce-marker&$]" to prevent remark to remove the ignored \n 
    //     return '\n\n' + returnSpaceMarker.repeat(crSpaces);
    // });


    // IGNORE (abrivate by the format)
    // four spaces at the beginning is code block
    // spaces before - is dealt with by lists
    
    // ESCAPE - information would get lost
    // 1-3 spaces before  # 
    // spaces more than one in headers  #   bar # 
    // spaces after the closing sequence
    
    // non escape closing sequence #


    const proc = remark().use(remarkGfm, {})
    const actual = proc.parse(preparedDocument)

    const md = toMarkdown(actual, {extensions: [gfmToMarkdown()]});

    // @ts-ignore
    window.actual = actual;
    // @ts-ignore
    window.back = md;

    // paragraph is 1

    let text = '';
    let annotations = [] as SequenceAnnotation[];
    let openInsAnnotatoin = undefined as number | undefined
    
    const crSpacePosition = [] as number[];

    traverse(actual, 0);

    // 0123456789
    // |-------| <- a [0,8] 
    //  |---|||  <- b  [1,5] -> [0,1]
    //    ||   <-c    [3,4] -> [0,1]
    // 
    // width = sum(widthChilds) 
    // left = min(leftParents)
    function traverse(node: any, currentStart: number, ) {
        if (node.children && node.children.length > 0) {

            let siblingsWidth = 0;
            // if (node.type === 'paragraph' && node.position.start.offset !== currentStart) {
            //     console.log('OFF BY ' + (node.position.start.offset - currentStart));
            //     console.log(node.type);
                
            //     const unrenderedSpaces = node.position.start.offset - currentStart;
            //     siblingsWidth += unrenderedSpaces;
            //     text += zeroWidthSpace.repeat(unrenderedSpaces)
            // }

            for (const childNode of node.children) {
                siblingsWidth += traverse(childNode, currentStart + siblingsWidth)
            };

            let addedChars = 0;

            if (node.type === 'heading') {
                // new lines after headings are removed by remark - we need this for the delta to attache the new heading information to
                text += newLineHelperMarker
                // the placeholder will get replaced by one \n -> add this to the offset
                addedChars += 1;
                // at quill the header annot ation is attached to \n that follows the heading
                annotations.push({
                    start: currentStart + siblingsWidth,
                    end: currentStart + siblingsWidth + 1,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'header',
                        data: node.depth,
                    }
                })
            } else if (node.type === 'strong') {
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'bold',
                        data: true,
                    }
                })
            } else if (node.type === 'emphasis') {
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'italic',
                        data: true,
                    }
                })
            } else if (node.type === 'delete') {
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'strike',
                        data: true,
                    }
                })
            } else if (node.type === 'paragraph') {
                addedChars += 1;
                text += '\n';
            } else if (node.type === 'html') {
                
                // if (node.value.match(/<br\s*\/?>/gi).length > 0) {
                //     leafWidth = 1;
                //     text += '\n';
                // }
            }

            return siblingsWidth + addedChars;
        } else {
            
            let leafWidth = (node.position.end.offset - node.position.start.offset)
            console.log('TYPE', node.type, node.value);
            console.log('orginal position', node.position)
            console.log('new position', {
                start: currentStart,
                end: currentStart + leafWidth,
            })
            let newReplacements = 0;
            if (node.type === 'text') {
                 
                // replace all single \n with a space - to prevent quil to turn them into paragraphs
                const preparedText = node.value.replace(/((?<!\n)\n(?!\n))/g, (match: string, group: any, offset: number) => {
                    crSpacePosition.push(currentStart + offset);
                    return ' ';
                });

                leafWidth = preparedText.length;
                text += preparedText


                // const countReturnSpaceMarker = node.value.split(returnSpaceMarker).length - 1
                // newReplacements = countReturnSpaceMarker * (returnSpaceMarker.length - 1); 

                // if (text.endsWith('\n\n')) {
                //     // ignore all leading \n in current text - offset correction done previously
                //     newReplacements += 1;
                // } else if (text.endsWith('\n') && node.value.startsWith('\n') && !node.value.startsWith('\n\n')) {
                //     // the previous text closed with a single \n - check if the current value starts with an \n 
                //     // ignore the case that it starts with \n\n - because this would be counted with the search for \n
                //     newReplacements += 1;
                // }

                // // we will replacce all \n\n with a single \n later on - this reduces the offset 
                // newReplacements += [...node.value.matchAll(/\n+/g)].length
                
                // text += node.value;
                
            } else if (node.type === 'html') {
                if (node.value === '<ins>') {
                    
                    openInsAnnotatoin = currentStart;
                    leafWidth = 0;
                } else if (node.value === '</ins>') {
                    leafWidth = 0;
                    if (openInsAnnotatoin === undefined) {
                        // TODO handle unopend ins
                    } else {
                        annotations.push({
                            start: openInsAnnotatoin,
                            end: currentStart,
                            growType: 'grow-right',
                            version: version,
                            data: {
                                name: 'underline',
                                data: true,
                            }
                        });
                        openInsAnnotatoin = undefined
                    }
                } if (node.value.match(/<br\s*\/?>/gi)?.length > 0) {
                    // TODO <br> creates a paragaph at the moment - introduce br blot in quill
                    leafWidth = 1;
                    text += '\n';
                }
            }
            return leafWidth - newReplacements;
        }
    }

    for (const crSpace of crSpacePosition) {
        annotations.push({
            start: crSpace,
            end: crSpace+1,
            growType: 'grow-right',
            version: version,
            data: {
                name: 'crspace',
                data: true,
            }
        })
    }

    // // replace single [^\n]\n[^\n] with ' ' and add md-newLine annotation (no offsets)
    // text = text.replace(/((?<!\n)\n(?!\n))/g, (match, group, offset) => {
    //     crSpacePosition.push(offset);
    //     return ' ';
    // });

    // use an zero width space to represent a non rendered \n
    text = text.split(returnSpaceMarker).join('\u200b')

    // replace helper marker we aded for headers with  real \n
    text = text.split(newLineHelperMarker).join('\n')


    // let crdtAnnotations = [] as SequenceAnnotation[];
    // for (const annotation of documentTokens.annotations) {
    //   if (annotation.type === 'heading') {
    //     crdtAnnotations.push({
    //       start: annotation.start,
    //       version: version,
    //       end: annotation.end,
    //       growType: "grow-right",
    //       data: {
    //         name: "header",
    //         data: annotation.attributes.level
    //       }
    //     })
        
    //   } else if (annotation.type === 'strong') {
    //       crdtAnnotations.push({
    //         start: annotation.start,
    //         end: annotation.end,
    //         version: version,
    //         growType: "grow-right",
    //         data: {
    //           name: "bold",
    //           data: true,
    //         }
    //       })
    //   } else if (annotation.type === 'link') {
    //     // href, title
    //   } else if (annotation.type === 'em') {
    //     crdtAnnotations.push({
    //       start: annotation.start,
    //       end: annotation.end,
    //       version: version,
    //       growType: "grow-right",
    //       data: {
    //         name: "italic",
    //         data: true,
    //       }
    //     })
    //   } 
    // }
    // debugger;

    console.log(annotations);
    return {
        sequence: text,
        annotations: annotations
    };
  }

export class RichtextCrdt extends EventTarget {

    rootVersion: string;
    versions: { [versionId: string]: string[] | null; };
    annotations: SequenceAnnotation[];
    currentHeadVersions: any[];
    rootNode: any;
    author: string;
    randomSeed: string;
    currentVersionIndex: number;

    constructor(startSequence: string, author: string) {
        super();
        this.rootVersion = 'v_' + 1// + RichtextCrdt.hash(startSequence)
        this.versions = {
            [this.rootVersion]: null,
        }
        const parsedCRDT = toCrdt(startSequence, this.rootVersion);

        this.annotations = [];

        this.addAnnotationsLocal(this.rootVersion, parsedCRDT.annotations)

        this.currentHeadVersions = [this.rootVersion]

        this.rootNode = sequence_crdt.create_node(this.rootVersion, parsedCRDT.sequence)

        this.author = author;
        this.randomSeed = crypto.randomUUID() + '';
        this.currentVersionIndex = 0;

        fromCrdt(this.getDelta());
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

        let sequenceDelta = new Delta([{
            insert: this.getSequence()
        }]);
        
        console.log('getDelta')
        this.traverseFrom(this.rootVersion, (version: string) => {
            for (const annotation of this.annotations) {
                if (annotation.version !== version || annotation.currentStart === undefined || annotation.currentStart === -1) {
                    continue
                }
    
                const annotationDelta = new Delta();
                annotationDelta.retain(annotation.currentStart);
                annotationDelta.retain(annotation.currentEnd! - annotation.currentStart, { [annotation.data.name]: annotation.data.data });
                
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
                elementsToInsert = op.insert;
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
                } else {
                    attributesDelta.retain(op.retain!, op.attributes)
                }
            }
        }

        let afterEditState = currentCRDTState.compose(attributesDelta)


        if (afterEditState.ops.length > 0) {

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
                        growType: attribute === 'link' ? 'no-grow' : 'grow-right', 
                        data: {
                            name: attribute, 
                            data: data
                        }
                    })
                }
                currentPosition += op.retain! as number
            }
            
                //     

            //debugger;
        }
        
        // TODO increase anotaion pointer (not shared)

        this.addAnnotationsLocal(localVersion, annotationsInVersion);

        this.dispatch({
            type: 'versionAdded',
            source: 'local',
            batchIndex: 0,
            batchSize: 1,
            version: { id: localVersion, t: 'PersistableVersion', parents: currentHead, splices: splices, annotations: annotationsInVersion}
        })
    }

    private addVersionLocal(splices: any) {
        this.currentVersionIndex += 1;
        const newLocalVersion = this.author + '_' + this.randomSeed + '_' +  this.currentVersionIndex;

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

                const maxLength = this.getSequence().length -1;

                if (insert_pos <= currentAnnotationStart && sliceEnd <= currentAnnotationStart) {
                    // slice starts and ends before the annotation move the annotation to the left or right
                    currentAnnotationStart += offset;
                    currentAnnotationEnd += offset
                    if (currentAnnotationEnd > maxLength) {
                        throw new Error('growed to much');
                    }

                    console.log('case 1', structuredClone(annotation))
                } else if (insert_pos < currentAnnotationStart && sliceEnd > currentAnnotationEnd) {
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
                    if (currentAnnotationEnd > maxLength) {
                        throw new Error('growed to much');
                    }
                } else if (insert_pos > currentAnnotationStart && sliceEnd < currentAnnotationEnd) {
                    // slice starts and ends in an annotation expand or decrease the annotation (in/decreases the end) by its offset
                    console.log('case 4', structuredClone(annotation))
                    console.log('currentAnnotationEnd: ' +currentAnnotationEnd);
                    console.log('addedOffset: ' +offset);
                    currentAnnotationEnd += offset;
                    if (currentAnnotationEnd > maxLength) {
                        throw new Error('growed to much');
                    }
                } else if (insert_pos > currentAnnotationStart && insert_pos < currentAnnotationEnd && sliceEnd > currentAnnotationEnd) {
                    // slices starting in an annotation and ending outside - expand the annotation by the offset
                    console.log('case 5', structuredClone(annotation))
                    currentAnnotationEnd += offset;
                } else if (insert_pos == currentAnnotationEnd) {
                    // slices starting at the end of an annotation depend on the growth methodic
                    if (annotation.growType === 'grow-right') {
                        currentAnnotationEnd += offset;
                        if (currentAnnotationEnd > maxLength) {
                            throw new Error('growed to much');
                        }
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
        this.annotations = this.annotations.concat(version.annotations);

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