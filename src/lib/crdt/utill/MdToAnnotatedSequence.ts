
import {remark} from 'remark'
import remarkGfm from 'remark-gfm'
import { SequenceAnnotation } from '../SequenceAnnotation';


const newLineHelperMarker = '[$&new-line-helper-marker&$]';
  
const mdToAnotatedSequence = (md: string, version: string)  => {

  // extract the syntax tree from the markdown
  const mdAst = remark().use(remarkGfm, {}).parse(md)
  let text = '';
  let annotations = [] as SequenceAnnotation[];
  let openInsAnnotation = undefined as number | undefined

  let currentRow = crypto.randomUUID()
  let currentTable = crypto.randomUUID();

  const crSpacePosition = [] as number[];

  traverse(mdAst, 0, null, 0);

    // 0123456789
    // |-------| <- a [0,8] 
    //  |---|||  <- b  [1,5] -> [0,1]
    //    ||   <-c    [3,4] -> [0,1]
    // 
    // width = sum(widthChilds) 
    // left = min(leftParents)
    function traverse(node: any, currentStart: number, parent: any, childIndex: number) {
        if (node.children && node.children.length > 0) {

            let siblingsWidth = 0;
            let childIndex = 0;
            for (const childNode of node.children) {
                siblingsWidth += traverse(childNode, currentStart + siblingsWidth, node, childIndex)
                childIndex += 1;
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
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'header',
                        value: node.depth,
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
                        value: true,
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
                        value: true,
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
                        value: true,
                    }
                })
            } else if (node.type === 'link') {
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'link',
                        value: {
                            title: node.title,
                            url: node.url,
                        },
                    }
                })
            } else if (node.type === 'listItem') {
                const data = parent.ordered ? 'ordered' : 'bullet';
                const indent = (node.position.start.column - 1) / 4;
                if (indent > 0) {
                    annotations.push({
                        start: currentStart,
                        end: currentStart + siblingsWidth,
                        growType: 'no-grow',
                        version: version,
                        data: {
                            name: 'indent',
                            value: indent,
                        }
                    })
                }
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'list',
                        value: data,
                    }
                })
            } else if (node.type === 'list') {

                
                // TODO LIST - this might be needed if we want to have separate lists next to each other
                // console.warn('list not implemented');
                // console.log(node);
                // annotations.push({
                //     start: currentStart,
                //     end: currentStart + siblingsWidth,
                //     growType: 'no-grow',
                //     version: version,
                //     data: {
                //         name: 'list-container',
                //         data: true
                //     }
                // })
            } else if (node.type === 'tableCell') {
                // TODO LIST ITEM
                // new lines after headings are removed by remark - we need this for the delta to attache the new heading information to
                text += newLineHelperMarker
                // the placeholder will get replaced by one \n -> add this to the offset
                addedChars += 1;
                // at quill the header annot ation is attached to \n that follows the heading
                annotations.push({
                    start: currentStart + siblingsWidth,
                    end: currentStart + siblingsWidth + 1,
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'table',
                        value: currentTable + '-' + currentRow,
                    }
                })
            } else if (node.type === 'tableRow') {
                currentRow = crypto.randomUUID()
                // TODO LIST ITEM
                // console.warn('listItem not implemented');
                // console.log(node);
                
                // annotations.push({
                //     start: currentStart,
                //     end: currentStart + siblingsWidth,
                //     growType: 'grow-right',
                //     version: version,
                //     data: {
                //         name: 'table-row',
                //         data: null,
                //     }
                // })
            } else if (node.type === 'table') {
                // const char =  '\u000b'// '\u000b';
                currentTable = crypto.randomUUID();
                // text += char
                // text += '\n';
                // addedChars = 1;
                // annotations.push({
                //     start: currentStart,
                //     end: currentStart,
                //     growType: 'no-grow',
                //     version: version,
                //     data: {
                //         name: 'break',
                //         data: true,
                //     }
                // })
                // text += newLineHelperMarker
                // // the placeholder will get replaced by one \n -> add this to the offset
                // addedChars += 1;
                // at quill the header annot ation is attached to \n that follows the heading
                
                // TODO LIST ITEM
                // console.warn('listItem not implemented');
                // console.log(node);
                
                // annotations.push({
                //     start: currentStart,
                //     end: currentStart + siblingsWidth,
                //     growType: 'grow-right',
                //     version: version,
                //     data: {
                //         name: 'table-body',
                //         data: true,
                //     }
                // })

                // annotations.push({
                //     start: currentStart,
                //     end: currentStart + siblingsWidth,
                //     growType: 'grow-right',
                //     version: version,
                //     data: {
                //         name: 'table-container',
                //         data: true,
                //     }
                // })
            } else if (node.type === 'blockquote') {
                // TODO blockquote 
                console.warn('list not implemented');
                annotations.push({
                    start: currentStart,
                    end: currentStart + siblingsWidth,
                    // TODO check growth type
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'blockquote',
                        value: true,
                    }
                })
            } else if (node.type === 'root') {
                // TODO blockquote 
                console.warn('do we need root?');
            } else if (node.type === 'paragraph') {
                addedChars += 1;
                text += '\n';
            } else if (node.type === 'html') {
                
                // if (node.value.match(/<br\s*\/?>/gi).length > 0) {
                //     leafWidth = 1;
                //     text += '\n';
                // }
            } else {
                throw new Error("Type " + node.type + " not supported yet");
            }

            return siblingsWidth + addedChars;
        } else {
            
            let leafWidth = (node.position.end.offset - node.position.start.offset)
            
            let newReplacements = 0;
            if (node.type === 'text') {
                 
                // replace all single \n with a space - to prevent quill to turn them into paragraphs
                const preparedText = node.value.replace(/((?<!\n)\n(?!\n))/g, (match: string, group: any, offset: number) => {
                    crSpacePosition.push(currentStart + offset);
                    return ' ';
                });

                leafWidth = preparedText.length;
                text += preparedText

            } else if (node.type === 'html') {
                if (node.value === '<ins>') {
                    
                    openInsAnnotation = currentStart;
                    leafWidth = 0;
                } else if (node.value === '</ins>') {
                    leafWidth = 0;
                    if (openInsAnnotation === undefined) {
                        // TODO handle unopend ins
                    } else {
                        annotations.push({
                            start: openInsAnnotation,
                            end: currentStart,
                            growType: 'grow-right',
                            version: version,
                            data: {
                                name: 'underline',
                                value: true,
                            }
                        });
                        openInsAnnotation = undefined
                    }
                } if (node.value.match(/<br\s*\/?>/gi)?.length > 0) {
                    // TODO <br> creates a paragaph at the moment - introduce br blot in quill
                    const char =  '\u000b'// '\u000b';
                    text += char
                    leafWidth = char.length;
                }
            } else if (node.type === 'thematicBreak') {
                const char =  '\u200b';
                text += char
                leafWidth = char.length;
                annotations.push({
                    start: currentStart,
                    end: currentStart,
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'divider',
                        value: true,
                    }
                })
            } else if (node.type === 'inlineCode') {
                leafWidth = node.value.length;
                text += node.value
                
                annotations.push({
                    start: currentStart,
                    end: currentStart + leafWidth,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'code',
                        value: true,
                    }
                })
            } else if (node.type === 'code') {
                leafWidth = node.value.length;
                text += node.value
                
                annotations.push({
                    start: currentStart,
                    end: currentStart + leafWidth,
                    growType: 'grow-right',
                    version: version,
                    data: {
                        name: 'code-block',
                        value: true,
                    }
                })
            } else if (node.type === 'image') {
                // add an zero width space as marker character for the image
                const char =  '\u200b';
                text += char
                leafWidth = char.length;
                
                // console.log(node);
                annotations.push({
                    start: currentStart,
                    end: currentStart+1,
                    growType: 'no-grow',
                    version: version,
                    data: {
                        name: 'image',
                        value: node.url,
                        attributes: {
                            alt: node.alt
                        }
                    }
                })
            } else if (node.type === 'break') {
                const char =  '\u000b'// '\u000b';
                text += char
                leafWidth = char.length;
                // annotations.push({
                //     start: currentStart,
                //     end: currentStart,
                //     growType: 'no-grow',
                //     version: version,
                //     data: {
                //         name: 'LineBreak',
                //         data: true,
                //     }
                // })
            } else {
                throw new Error('unsupported' + node.type + ' ' + JSON.stringify(node));
            }
            return leafWidth - newReplacements;
        }
    }

    for (const crSpace of crSpacePosition) {
        annotations.push({
            start: crSpace,
            end: crSpace+1,
            growType: 'no-grow',
            version: version,
            data: {
                name: 'crspace',
                value: true,
            }
        })
    }

    // replace helper marker we aded for headers with real \n
    text = text.split(newLineHelperMarker).join('\n')

    if (annotations.find(a => a.end === text.length) === undefined) {
        // remove the trailing new line - will be added by quill anyway
        text = text.slice(0, -1)
    }

    return {
        sequence: text,
        annotations: annotations
    };
}

export default mdToAnotatedSequence