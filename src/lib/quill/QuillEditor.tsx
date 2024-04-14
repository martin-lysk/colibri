/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable max-classes-per-file */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';


// import './quill.bubble.css';

import { RichtextCrdt, VersionAdded } from '../crdt/RichtextCRDT'

// import './TranslationEditor.css';

import Quill from 'quill';
import QuillCursors from 'quill-cursors'
import { DiscussionAttributor } from './DiscussionAttributor';
import { MaterializedDiscussionThread } from '../crdt/Discussions';

import Table from './modules/table';

const BlockEmbed = Quill.import('blots/block/embed') as any;
var Parchment = Quill.import('parchment') as any;

class DividerBlot extends BlockEmbed {
  static blotName = 'divider';
  static tagName = 'hr';
}

Quill.register(DividerBlot);

Quill.register({'modules/table': Table});

// class Break2 extends EmbedBlot {
//   static value() {
//     return undefined;
//   }

//   optimize() {
//     // if (this.prev || this.next) {
//     //   this.remove();
//     // }
//   }

//   length() {
//     return 0;
//   }

//   value() {
//     return '';
//   }
// }
// Break2.blotName = 'break';
// Break2.tagName = 'br';


// Quill.register({
//   'blots/break': Break2,
// }, true);

// let Break = Quill.import('blots/break') as any;
// Break.prototype.optimize = () => {
//   // we don't optimize breakes to not split them into paragraphs
// };

// // let Break = Quill.import('blots/break') as any;
// // let Embed = Quill.import('blots/embed') as any;

// // Break.prototype.insertInto = function(parent: any, ref: any) {
// //   debugger;
// //   Embed.prototype.insertInto.call(this, parent, ref)
// // };
// Break.prototype.length= function() {
//   return 1;
// }
// Break.prototype.value= function() {
//   return '\u000b';
// }

// let TextBlot = Quill.import('blots/text') as any;
// let Block = Quill.import('blots/block') as any;

// (Block as any).defaultChild = null

// Quill.register({ 'formats/comment': new Comment() });


// import PlaceholderBlot from './blots/PlaceholderBlot';
// import BoldBlot from './blots/BoldBlot';
// import { MyListContainer, MyListItem } from './blots/MyList';
// import ItalicBlot from './blots/ItalicBlot';
// import LinkBlot from './blots/LinkBlot';
// import TextDecorationBlot from './blots/TextDecorationBlot';
// import TooltipToolbar from './toolbar/TooltipToolbar';
// import { Locale } from '../../../lib/message/variants/Locale';

// Quill.register(MyListItem, true);
// Quill.register(LinkBlot, true);
// Quill.register(ItalicBlot, true);
// Quill.register(BoldBlot, true);
// Quill.register(PlaceholderBlot, true);
// Quill.register(MyListContainer, true);

// Quill.register(TextDecorationBlot);
// const icons = Quill.import('ui/icons');
// icons.textDecoration = {
//   UNDERLINE: icons.underline,
//   STRIKETHROUGH: icons.strike,
// };
const saveOnEnter = true;

let Embed = Quill.import('blots/embed') as any;

class ShiftEnterBlot extends Embed {
  static create(value: any) {
    let node = super.create(value);
    node.__rand = value;

    node.innerHTML = '<br>';
    return node;
  }


  static formats(domNode: any) {
    let blot = Parchment.Registry.find(domNode);

    if (blot && blot.parent && blot.parent.children &&
        blot.parent.children.head !== blot)
        return domNode.__rand;
    }
  
    html() {
      return '<br />'
    }      
}

ShiftEnterBlot.blotName = 'LineBreak';
ShiftEnterBlot.tagName = 'SPAN';
ShiftEnterBlot.className = 'shift-enter-class';

// Inline.order = [ShiftEnterBlot.blotName, ...Inline.order];

Quill.register(ShiftEnterBlot);


const Delta = Quill.import('delta');

Quill.register({ 'formats/discussion': new DiscussionAttributor() });
Quill.register({ 'modules/cursors': QuillCursors });



function getTop(anchor: HTMLElement | null) {
  // Recurse up the tree until you find the article (nested relative offsets)
  let el: HTMLElement | null = anchor;
  let top = 0;
  let left = 0;
  do {
      top += el?.offsetTop || 0;
      left += el?.offsetLeft || 0;
      el = (el?.offsetParent ?? null) as HTMLElement | null;
  } while (el && !el.classList.contains('ql-container'));
  return top;
}

function extractTopPositions() {

    // Create a map to store discussion IDs and their corresponding top positions
    const discussionTopsMap: {[threadId: string]: number} = {};

    // match all with class discussion, go through class list and find the once with "discussion-" prefix, remove the prefix
    // Get all elements with class ".discussion"
    const discussionElements = document.querySelectorAll('.discussion');

    // Iterate through each element and extract the discussion ID
    discussionElements.forEach(element => {
        const classNames = element.className.split(' '); // Split class names
        classNames.forEach(className => {
            if (className.startsWith('discussion-id_')) {
                const discussionId = className.split('-').splice(1).join('-'); // Extract discussion ID
                const topPosition = getTop(element as HTMLElement)
                discussionTopsMap[discussionId] = discussionTopsMap[discussionId] ? Math.min(discussionTopsMap[discussionId], topPosition) : topPosition; // Store in the map
            }
        });
    });

    // Step 1: Get all elements with class ".ql-cursor"
    const qlCursorElements = document.querySelectorAll('.ql-cursor');

    // Step 2: Iterate through each element and extract the ID
    qlCursorElements.forEach(element => {
        if (element.id.startsWith('ql-cursor-')) {
            const discussionId = element.id.substring('ql-cursor-'.length); // Extract ID
            if (discussionId.startsWith('id_')) {
                const topPosition = getTop(element.getElementsByClassName('ql-cursor-selection-block')[0] as HTMLElement);
                discussionTopsMap[discussionId] = discussionTopsMap[discussionId] ? Math.min(discussionTopsMap[discussionId], topPosition) : topPosition; // Store in the map
            }
        }
    });

    return discussionTopsMap;
}


type QuillEditorProps = {
  richtextCRDT: RichtextCrdt,
  discussions: MaterializedDiscussionThread[],
  onAddDiscussionComment: (discussionId: string) => void,
  onDiscussionHightlightChange: (discussionId: string | null) => void,
  onDiscussionTopPositionsChange: (topPositions: {[threadId: string]: number}) => void,
};

export type QuillEditorHandle = {
  deleteId: (id: string) => void,
  resolveById: (id: string) => void,
  createDiscussion: (id: string, comment: string) => void,
  reactTo: (id: string, reaction: string, untoggle: boolean) => void,
  createComment: (discussionId: string, comment: string) => void, 
}

// We use this view in two ocations:
//  - key editor placeholders no fillins
//  - label editor - text should contain the placeholders but the editor needs to know the fillins?
export default forwardRef<QuillEditorHandle, QuillEditorProps>(({
  richtextCRDT,
  discussions,
  onAddDiscussionComment,
  onDiscussionHightlightChange,
  onDiscussionTopPositionsChange,
}: QuillEditorProps, ref) => {
  const [textState, setTextState] = useState('');
  const textRef = useRef('');

  const editorPreRef = useRef<HTMLPreElement>(null);
  
  const quillEditor = useRef<Quill | undefined>(undefined);

  const tooltipContainerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    deleteId(id: string) {
      const cursors = quillEditor.current?.getModule('cursors') as QuillCursors;
      cursors.removeCursor(id);
      // remove discussion from annotation and comments from comments
    },
    resolveById(id: string) {
      const cursors = quillEditor.current?.getModule('cursors') as QuillCursors;
      cursors.removeCursor(id);
      // update discussion state
    },
    createDiscussion(id: string, comment: string) {
      // remove cursor and select the 
      const cursors = quillEditor.current?.getModule('cursors') as QuillCursors;
      const cursor = cursors.cursors().find(c => c.id === id);
      const editor = quillEditor.current;

      if (!cursor || !editor) {
        return;
      }
      editor.setSelection(cursor.range);
      quillEditor.current?.format('discussion', id)
      cursors.removeCursor(id);
      editor.focus();

      // update discussion state
    },
    createComment(discussionId: string, comment: string) {
      
      // update discussion state
    },
    reactTo(id: string, reaction: string, untoggle: boolean) {
      throw new Error('Function not implemented.');
    },
  }));

  useEffect(() => {

    const onVersionAdded = (e: any) => {
      let event = e.detail as VersionAdded; 
      const currentQuillEditor = quillEditor.current;
      
      if (event.source === 'remote' && event.batchSize === (event.batchIndex + 1) && currentQuillEditor !== undefined) {
            
        const contents = richtextCRDT.getDelta();
        const editorContents = currentQuillEditor.getContents();

        try {
          const diff = editorContents.diff(contents);  
          currentQuillEditor.updateContents(diff, 'silent');
        } catch (e) {
          console.log('non document :-/')
          currentQuillEditor.setContents(contents, 'silent')
        }
      }
    }

    richtextCRDT.addEventListener('versionAdded', onVersionAdded as any)
    return () => {
      richtextCRDT.removeEventListener('versionAdded', onVersionAdded as any);
    }
  }, []);

  let queuedDeltas = [] as any[];

  const onEditorChange = (
    eventName: 'text-change' | 'selection-change',
    rangeOrDelta: any, // Range | Delta,
    oldRangeOrDelta: any, // Range | DeltaStatic,
    source: any,//Sources,
  ) => {
    if (eventName === 'selection-change' && rangeOrDelta) {
      // inspiration from https://stackoverflow.com/questions/41551992/get-delta-at-cursor-no-selection-without-splitting-it
      

      const pathResultAtCursor = quillEditor.current!.scroll.path(rangeOrDelta.index);
      const elementAtCursor = pathResultAtCursor?.[1]?.[0] as any | undefined;

      const pathResultAfterCursor = quillEditor.current!.scroll.path(rangeOrDelta.index +1);
      const elementAfterCursor = pathResultAfterCursor?.[1]?.[0] as any | undefined;

      let selected = undefined as any;
      const cursors = quillEditor.current!.getModule('cursors') as QuillCursors;

      const discussions = new Set<string>();
      if (elementAtCursor?.attributes?.attributes?.discussion) {
        (elementAtCursor.domNode as Element).className.split(' ').filter(clasName => clasName.startsWith('discussion-')).forEach(className => discussions.add(className.substring(11)));
      }

      if (elementAfterCursor?.attributes?.attributes?.discussion) {
        (elementAfterCursor.domNode as Element).className.split(' ').filter(clasName => clasName.startsWith('discussion-')).forEach(className => discussions.add(className.substring(11)));
      }

      console.log(discussions);
      const discussionAnnotations = {} as any;
      if (discussions.size > 0) {
        richtextCRDT.annotations.forEach(annnotation => {
          if (annnotation.data.name === 'discussion' && annnotation.data.value) {
            for (const discussionIdInAnnotation of annnotation.data.value) {
              if (discussions.has(discussionIdInAnnotation)) {
                if (!discussionAnnotations[discussionIdInAnnotation]) {
                  discussionAnnotations[discussionIdInAnnotation] = {
                    start: annnotation.currentStart!,
                    end: annnotation.currentEnd!,
                  }
                } else {
                  discussionAnnotations[discussionIdInAnnotation].start = Math.min(discussionAnnotations[discussionIdInAnnotation].start, annnotation.currentStart!);
                  discussionAnnotations[discussionIdInAnnotation].end = Math.max(discussionAnnotations[discussionIdInAnnotation].end, annnotation.currentEnd!);
                }          
              }
            }
          }
        })
        console.log(discussionAnnotations);

        
        
      }
      
      for (const cursor of cursors.cursors()) {
        if (cursor.id.startsWith('id_') && cursor.range.index <= rangeOrDelta.index && (cursor.range.index + cursor.range.length) >= rangeOrDelta.index) {
          discussionAnnotations[cursor.id] = {
            start: cursor.range.index,
            end: cursor.range.index + cursor.range.length,
          };
          
        }
      }

      
      for (const [id, da] of Object.entries(discussionAnnotations)) {
        if ((da as any).start > rangeOrDelta.index || (da as any).end < (rangeOrDelta.index + rangeOrDelta.length)) {
          continue
        }

        if (!selected) {
          selected = da;
          selected.id = id;
        } else {
          if ((rangeOrDelta.index - selected.start) > (rangeOrDelta.index - (da as any).start)) {
            selected = da;
            selected.id = id;
          }
        }
      }
      if (selected) {
        cursors.createCursor('hightlighted_disscussion', 'name', 'blue');
        cursors.moveCursor('hightlighted_disscussion', {
          index: selected.start,
          length: selected.end - selected.start
        });
        onDiscussionHightlightChange(selected.id);
      } else {
        onDiscussionHightlightChange(null);
        cursors.removeCursor('hightlighted_disscussion');
      }

      // const formats = quillEditor.current!.getFormat(range.index);
      // if (formats.bold) {
      //     // Bold text is present at the cursor position
      //     const bounds = quill.getBounds(cursorPosition);
      //     console.log("Range of bold text:", bounds);
      // } else {
      //     // No bold text at the cursor position
      //     console.log("No bold text at cursor position.");
      // }
    }
    if (eventName === 'text-change' && source !== 'silent') {
      
      if (!quillEditor.current) {
        return;
      }

      const backslashPosition = oldRangeOrDelta.length() - 1;

      if (rangeOrDelta.ops.length === 1 && rangeOrDelta.ops[0].retain === 1 && backslashPosition === 0) {
        if (Object.values(rangeOrDelta.ops[0].attributes).filter(v => v !== null).length > 0) {
          delete rangeOrDelta.ops[0].retain;
          rangeOrDelta.ops[0].insert = '\n';
        }
      } else if (rangeOrDelta.ops.length === 2 && rangeOrDelta.ops[0].retain === backslashPosition && rangeOrDelta.ops[1].retain === 1) {
        if (Object.values(rangeOrDelta.ops[1].attributes).filter(v => v !== null).length > 0) {
          delete rangeOrDelta.ops[1].retain;
          rangeOrDelta.ops[1].insert = '\n';
        }
      }
      queuedDeltas.push(rangeOrDelta);

      // combine delete and insert to replacement
      queueMicrotask(() => {
        if (queuedDeltas.length === 0) {
            return
        } 
        
        let delta = new Delta();
        for (const deltaToProcess of queuedDeltas) {
            delta = delta.compose(deltaToProcess);
        }

        queuedDeltas = [];
            
        richtextCRDT.handleDeltaLocal(delta);
      });

      

      // const updatedParameters = { ...parameterValues };
      // let htmlContent = quillEditor.current.root.innerHTML;

      // // start with real carrage returns
      // htmlContent = htmlContent.split('<p><br></p>').join('\n');
      // const paragraphs = htmlContent.split('</p>');
      // if (paragraphs[paragraphs.length - 1] === '') {
      //   paragraphs.pop();
      // }
      // htmlContent = paragraphs.join('\n').split('<p>').join('');
      // const regex = /.<span contenteditable="false">([^<]*)<\/span>./g;
      // htmlContent = htmlContent.replace(/contenteditable="false">/g, '>');
      // htmlContent = htmlContent.replace(regex, (match: any, group1: any) => group1);

      // if (htmlContent[htmlContent.length - 1] === '\n') {
      //   // fix last return - change init
      //   htmlContent = htmlContent.substring(0, htmlContent.length - 1);
      // }

      // handleChange(htmlContent, updatedParameters);
    } 

    queueMicrotask(() => {
      onDiscussionTopPositionsChange(extractTopPositions());
    })
  };

  function initQuill(editorElement: HTMLElement) {
    const editor = new Quill(editorElement, {
      theme: 'snow',
      modules: {
        // multi cursor support
        cursors: true,
        table: true,
        toolbar: {
                container: '#toolbar-container',
                // [
                //     [{ 'header': [1, 2, 3, 4, 5, 6, false] }], 
                //     ['bold', 'italic', 'underline', 'strike', 'comment'], 
                //     [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],   
                // ],
                handlers: {
                    'table-add' : function() {
                        (editor.getModule('table') as Table).insertTable(2, 2);
                    },
                    'table-insert-row-above' : function() {
                      (editor.getModule('table') as Table).insertRowAbove();
                    },
                    'ql-table-insert-row-below' : function() {
                      (editor.getModule('table') as Table).insertRowBelow();
                    },
                    'ql-table-insert-column-left' : function() {
                      (editor.getModule('table') as Table).insertColumnLeft();
                    },
                    'ql-table-insert-column-right' : function() {
                      (editor.getModule('table') as Table).insertColumnLeft();
                    },
                    'ql-table-delete-table' : function() {
                      (editor.getModule('table') as Table).deleteTable();
                    },
                    'ql-table-delete-row' : function() {
                      (editor.getModule('table') as Table).deleteRow();
                    },
                    'ql-table-delete-column' : function() {
                      (editor.getModule('table') as Table).deleteColumn();
                    },
                    'discussion': function () {

                        const selection = editor.getSelection(false)
                        if (!selection) {
                          return
                        }

                        // if user is in empty line - deactivate discussion button
                        // if user has no selection - select closest word
                        // if user has selection - keep it

                        // update cursor to reflect new selection - flag to reset range if there was non before
                        const id = 'id_' + crypto.randomUUID();

                        const cursors = editor.getModule('cursors') as QuillCursors;
                        cursors.createCursor(id, 'User 1', 'red');
                        cursors.moveCursor(id, selection);

                        onDiscussionTopPositionsChange(extractTopPositions());
                        onAddDiscussionComment(id);
                        // (editor as any).newComment = true;
                        // editor.format('discussion', discussion);
                        // return discussion;
                    }
                }
        },
        keyboard: {
          bindings: {
            // handleEnter: {
            //   key: 'Enter',
            //   handler: function (range: any, context: any) {
            //     if (range.length > 0) {
            //       editor.scroll.deleteAt(range.index, range.length);  // So we do not trigger text-change
            //     }
            //     let lineFormats = Object.keys(context.format).reduce(function(lineFormats: any, format: string) {
            //       if (Parchment.query(format, Parchment.Scope.BLOCK) && !Array.isArray(context.format[format])) {
            //         lineFormats[format] = context.format[format];
            //       }
            //       return lineFormats;
            //     }, {});
            //     var previousChar = editor.getText(range.index - 1, 1);
            //     // Earlier scroll.deleteAt might have messed up our selection,
            //     // so insertText's built in selection preservation is not reliable
            //     editor.insertText(range.index, '\n', lineFormats, Quill.sources.USER);
            //     if (previousChar == '' || previousChar == '\n') {
            //       editor.setSelection(range.index + 2, Quill.sources.SILENT);
            //     } else {
            //       editor.setSelection(range.index + 1, Quill.sources.SILENT);
            //     }
            //     // (editor.selection as any).scrollIntoView();
            //     Object.keys(context.format).forEach((name) => {
            //       if (lineFormats[name] != null) return;
            //       if (Array.isArray(context.format[name])) return;
            //       if (name === 'link') return;
            //       editor.format(name, context.format[name], Quill.sources.USER);
            //     });
            //   }
            // },
            linebreak: {
              key: 'Enter',
              shiftKey: true,
              handler: function (range: any, context: any) {
                editor.insertEmbed(range.index, 'LineBreak', true, 'user');
                editor.setSelection(range.index + 1, Quill.sources.SILENT);
	              return false; // Don't call other candidate handlers
              }
            }
          }
        }
      }
    });
    editor.root.setAttribute('spellcheck', 'false');
    editor.root.classList.add('markdown-body');
    const contents = richtextCRDT.getDelta();
    editor.setContents(contents, 'silent')
    onDiscussionTopPositionsChange(extractTopPositions());

    // delete (editor as any).getModule('keyboard').bindings['9'];
    return editor;
  }

  // function updateQuill(
  //   currentQuillEditor: Quill,
  //   updatedHtml: string,
  // ) {
  //   // eslint-disable-next-line no-param-reassign
  //   (currentQuillEditor.clipboard as any).matchers[0][1] = function matchText(
  //     node: any,
  //     delta: any,
  //   ) {
  //     const text = node.data;
  //     return delta.insert(text);
  //   };
  //   // add extra cr
  //   // eslint-disable-next-line no-param-reassign
  //   updatedHtml += '\n';

  //   const cleanedValue = updatedHtml.split('\n').join('<br>');
  //   const contents = (currentQuillEditor.clipboard as any).convertHTML(cleanedValue) as any;

  //   currentQuillEditor.setContents(contents, 'silent');
  // }

  useEffect(() => {
    let quillEditorRef = quillEditor.current;
    if (!quillEditorRef) {
      quillEditorRef = initQuill(editorPreRef.current!);
      quillEditor.current = quillEditorRef;
    }

    if (quillEditor.current) {
      quillEditorRef?.on('editor-change', onEditorChange); 
    }
    
    return () => {
      quillEditorRef?.off('editor-change', onEditorChange);
    };
  }, []);

  let textToUse;
  

  const visibileDiscussionIdMatcher = [];
  const invisibleDiscussionIdMatcher = [];

  for (const discussion of discussions) {
    if (discussion.resolved || discussion.deletedAt) {
      invisibleDiscussionIdMatcher.push(".discussion.discussion-"+discussion.entityId.replace(/-/g, '\\-'));
    } else {
      visibileDiscussionIdMatcher.push(".discussion.discussion-"+discussion.entityId.replace(/-/g, '\\-'));
    }
  }

  return (
    
      <div
        className="quilleditor" 
      >
        <style>
          {".ql-editor .discussion { background-color: pink; } \n "}
          { visibileDiscussionIdMatcher.length > 0 ? visibileDiscussionIdMatcher.join(', ') + ' { background-color: rgba(252, 188, 5, 0.3) !important; } \n '  : ' '}
          { invisibleDiscussionIdMatcher.length > 0 ?  invisibleDiscussionIdMatcher.join(', ') + ' { background-color: transparent } \n' : ' ' }  
        </style>
        <pre ref={editorPreRef} />
        {/* <pre ref={editorPreRef} />
                {quillEditor.current
                  && scrollContainer.current
                  && !isDisabled
                  && editingState
                  && createPortal(
                    <div style={{ display: 'contents' }} ref={tooltipContainerRef}>
                      <TooltipToolbar
                        editorScrollContainer={scrollContainer.current}
                        editor={quillEditor.current}
                        rootView={document.body}
                        parameterValues={parameterValues}
                        // eslint-disable-next-line react/jsx-no-bind
                        setParameterValue={(
                          name: string,
                          value: string,
                          propagate: boolean,
                        ): void => {
                          // eslint-disable-next-line no-param-reassign -- TODO #34 check if this acutally works
                          parameterValues[name] = {
                            type: 'string',
                            value,
                          };
                          if (propagate) {
                            onChange?.(textRef.current, parameterValues);
                          }
                        }}
                      />
                    </div>,
                    document.body,
                  )} */}
      </div>
  );
})
