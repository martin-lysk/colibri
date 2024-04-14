import Delta from 'quill-delta' // importing quil-delta directly to be able to to run vitest
import { Op, AttributeMap } from "quill/core";
import { u } from 'unist-builder'
import {Root, RootContent, PhrasingContent, Heading, Image} from 'mdast'



const quillBlockContent = (delta: Delta): RootContent[] => {

  const removeCrSpacesDelta = new Delta();

  const crSpaces = [] as number[];

  let currentOpStartPosition =  0
  // delta.forEach(op => {

  //   if (op.attributes?.crspace) {
  //     crSpaces.push(currentOpStartPosition);
  //     const cleanedAttributes = structuredClone(op.attributes);
  //     delete cleanedAttributes.crspace;
  //     removeCrSpacesDelta.delete(1);
  //     removeCrSpacesDelta.insert(' ', cleanedAttributes)
  //   } else {
  //     removeCrSpacesDelta.retain(op.insert!.length as number);
  //   }
    
  //   currentOpStartPosition += op.insert!.length as number;
  // })

  const preparedDelta = delta.compose(removeCrSpacesDelta);

  const blocks: RootContent[] = []
  
  let currentCrSpace = crSpaces.shift();
  currentOpStartPosition = 0;

  let listElements = [] as any[]

  let currentRowId: string | undefined = undefined;
  let tableContents = [] as any[][]
  let currentRowIndex = 0;
  let currentColumnIndex = 0;
  
  preparedDelta.eachLine((line: Delta, lineAttributes: AttributeMap) => {

    // each cell is seen as a line here - we can use lineAttributes.table where each different value represents a row for now 
    // we need to keep track of the column indext by ourself for now 

    // thematicBreak are ops that are new lines but not taken as such by quill 
    while (typeof line.ops[0]?.insert !== 'string' && line.ops[0]?.insert?.['divider']) {
      blocks.push(u('thematicBreak'));
      line.ops.shift();
    } 

    let innerText = line.ops.map(({insert, attributes}: Op): PhrasingContent => {
        let content: PhrasingContent

        if (typeof insert === 'undefined') {
            throw new TypeError('Not a valid Document');
        } else if (typeof insert === 'string') {
            while (currentCrSpace && currentOpStartPosition >= currentCrSpace && (currentOpStartPosition + insert.length) < currentCrSpace) {
              const index = currentCrSpace - currentOpStartPosition;
              insert = insert.substring(0, index) + '\n' + insert.substring(index + 1);
              currentCrSpace = crSpaces.shift();
            }
            content = u('text', insert)
            currentOpStartPosition += insert.length;
        } else if ('image' in insert) {
          const image = insert as {
            image: string,
            alt: string
          }
          content = u('image', {url: image.image, alt: attributes?.alt, title: null}) as Image
        } else if ('LineBreak' in insert) {
          content = u('break')
        } else {
            throw new TypeError('unknown insert type ' + typeof insert + ' ' + JSON.stringify(insert))
        }
    
        if (typeof attributes === 'undefined') {
            return content
        }

        const allowed = ['link', 'strong', 'emphasis', 'delete', 'code']

        for (let key of Object.keys(attributes)) {
          if (!allowed.includes(key)) {
            // TODO 'header', table,
              // throw new Error(`Invalid property found: ${key}`);
              // You can also use alert instead of console.log if you prefer
              // alert(`Invalid property found: ${key}`);
          }
        }
      
        if ('link' in attributes) {
          content = u('link', (attributes as any).link, [content])
        }

        if ('code' in attributes) {
          content = u('inlineCode', insert as string)
        }

        if ('bold' in attributes) {
          content = u('strong', [content])
        }
    
        if ('italic' in attributes) {
          content = u('emphasis', [content])
        }
    
        if ('strike' in attributes) {
          content = u('delete', [content])
        }
    
        return content
    })

    // multi line parents (table, list)

    // handle table
    if (lineAttributes.table && currentRowId === undefined) {
      //
      // start of a new table
      //
      currentRowId = lineAttributes.table as string;
      tableContents = [[innerText]];

    } else if (lineAttributes.table && currentRowId && (lineAttributes.table as string).split('-')[0] !== currentRowId.split('-')[0]) {
      // 
      // a new table started while another ended directly after it
      // 
      currentRowId = lineAttributes.table as string;

      // render the current table first....
      const tableRows = [];
      for (const row of tableContents) {
        const rowCells = [];
        for (const column of row) {
          const cellContent = u('tableCell', column);
          rowCells.push(cellContent)
        }
        tableRows.push(u('tableRow', rowCells))
      }
      blocks.push(u('table', tableRows));

      // .... than start a new one
      tableContents = [[innerText]];
    } else if (lineAttributes.table && currentRowId === lineAttributes.table) {
      // start of a new column
      tableContents[tableContents.length - 1].push(innerText);
    }  else if (lineAttributes.table && currentRowId !== lineAttributes.table) {
      // start of a new table row
      tableContents.push([innerText]);
      currentRowId = lineAttributes.table as string;
    } else if (!lineAttributes.table && currentRowId !== undefined) {
      // end of the current table
      currentRowId = undefined;
      const tableRows = [];
      for (const row of tableContents) {
        const rowCells = [];
        for (const column of row) {
          const cellContent = u('tableCell', column);
          rowCells.push(cellContent)
        }
        tableRows.push(u('tableRow', rowCells))
      }
      blocks.push(u('table', tableRows));
    }

    if (lineAttributes.list) {
      let block: RootContent = u('paragraph', innerText)
      listElements.push(u(
        'listItem',
        // {depth: attributes.header as 1},
        [block]
      ) as any)
    } else if (!lineAttributes.list && listElements.length > 0) {
      blocks.push(u('list', {} , listElements));
      listElements = [];
    }


    // one line format
    if (currentRowId === undefined && listElements.length === 0) {
      if ('header' in lineAttributes) {
        blocks.push(u(
          'heading',
          {depth: lineAttributes.header as 1} as any,
          innerText as any
        ) as Heading)
      } else if ('blockquote' in lineAttributes) {
        blocks.push(u('blockquote', [u('paragraph', innerText)]));
      } else {
        let block: RootContent = u('paragraph', innerText)
        blocks.push(block)
      }
    }

  })

  if (currentRowId !== undefined) {
    // end of the current table
    currentRowId = undefined;
    const tableRows = [];
    for (const row of tableContents) {
      const rowCells = [];
      for (const column of row) {
        const cellContent = u('tableCell', column! as any);
        rowCells.push(cellContent)
      }
      tableRows.push(u('tableRow', rowCells))
    }
    blocks.push(u('table', tableRows));
  } else if (listElements.length > 0) {
      blocks.push(u('list', {} , listElements));
      listElements = [];
  }

  return blocks
}

const quillDeltaToMdast = (delta: Delta): Root => {
  return u('root', quillBlockContent(delta))
}

export default quillDeltaToMdast