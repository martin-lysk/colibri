import { Delta, Op, AttributeMap } from "quill/core";
import { u } from 'unist-builder'
import {Root, RootContent, PhrasingContent, Heading, Image} from 'mdast'



const quillBlockContent = (delta: Delta): RootContent[] => {

  const removeCrSpacesDelta = new Delta();

  const crSpaces = [] as number[];

  let currentOpStartPosition =  0
  delta.forEach(op => {

    if (op.attributes?.crspace) {
      crSpaces.push(currentOpStartPosition);
      const cleanedAttributes = structuredClone(op.attributes);
      delete cleanedAttributes.crspace;
      removeCrSpacesDelta.delete(1);
      removeCrSpacesDelta.insert(' ', cleanedAttributes)
    } else {
      removeCrSpacesDelta.retain(op.insert!.length as number);
    }
    
    currentOpStartPosition += op.insert!.length as number;
  })

  const preparedDelta = delta.compose(removeCrSpacesDelta);

  const blocks: RootContent[] = []
  
  let currentCrSpace = crSpaces.shift();
  currentOpStartPosition = 0;
  preparedDelta.eachLine((line: Delta, attributes: AttributeMap) => {
    let innerText = line.ops.map(({insert, attributes}: Op): PhrasingContent => {
        let content: RootContent
    
        if (typeof insert === 'undefined') {
            throw new TypeError('unknown insert type')
        } else if (typeof insert === 'string') {
            while (currentCrSpace && currentOpStartPosition >= currentCrSpace && (currentOpStartPosition + insert.length) < currentCrSpace) {
              const index = currentCrSpace - currentOpStartPosition;
              insert = insert.substring(0, index) + '\n' + insert.substring(index + 1);
              currentCrSpace = crSpaces.shift();
            }
            content = u('text', insert)
            currentOpStartPosition = currentOpStartPosition += insert.length;
        } else if ('image' in insert) {
            content = u('image', {url: (insert as {image: string}).image}) as Image
        } else {
            throw new TypeError('unknown insert type')
        }
    
        if (typeof attributes === 'undefined') {
            return content
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

   
    
    let block: RootContent = u('paragraph', innerText)

    if ('blockquote' in attributes) {
      block = u('blockquote', [block])
    }

    if ('header' in attributes) {
      block = u(
        'heading',
        {depth: attributes.header as 1},
        innerText
      ) as Heading
    }

    blocks.push(block)
  })

  return blocks
}

const quillDeltaToMdast = (delta: Delta): Root => {
  return u('root', quillBlockContent(delta))
}

export default quillDeltaToMdast