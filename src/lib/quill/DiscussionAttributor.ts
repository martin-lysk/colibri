
import Quill from "quill"

const Parchment = Quill.import('parchment');


export class DiscussionAttributor extends Parchment.ClassAttributor {
    constructor(attrName = 'discussion', keyName = 'discussion') {
      super(attrName, keyName, { scope: Parchment.Scope.INLINE_ATTRIBUTE });
    }
  
    add(node: HTMLElement, value: any) {
      if (!this.canAdd(node, value)) return false;
      const array = Array.isArray(value) ? value : [value];
      array.forEach((id) => {
        node.classList.add(`discussion`);
        node.classList.add(`${this.keyName}-${id}`);
      });
      return true;
    }
  
    removeComment(node: HTMLElement, id: string) {
      if (id == null) {
        super.remove(node);
      } else {
        const prefix = `${this.keyName}-`;
        node.classList.remove(`${this.keyName}-${id}`);
        
        if (![...node.classList].find(v => v.startsWith(prefix))) {
            node.classList.remove(`discussion`);
        }
        if (node.classList.length === 0) {
          node.removeAttribute('class');
        }
      }
    }
  
    value(node: HTMLElement) {
      const prefix = `${this.keyName}-`;
      
      const list = [...node.classList].filter((c) => {
        return c.startsWith(prefix);
      }).map((c) => {
        return c.slice(prefix.length);
      });
      return (list.length > 0) ? list : null;
    }
  }
  