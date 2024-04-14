import Quill, { Parchment } from 'quill';
import Block from 'quill/blots/block';
import Container from 'quill/blots/container';

class TableCell extends Block {
  static blotName = 'table';
  static tagName = 'TD';

  static create(value: string) {
    const node = super.create() as HTMLElement;
    if (value) {
      node.setAttribute('data-row', value);
    } else {
      throw new Error("OLD CODE: node.setAttribute('data-row', tableRowId())");
    }
    return node;
  }

  static formats(domNode: HTMLElement) {
    if (domNode.hasAttribute('data-row')) {
      return domNode.getAttribute('data-row');
    }
    return undefined;
  }

  // @ts-expect-error
  next: this | null;

  cellOffset() {
    if (this.parent) {
      return this.parent.children.indexOf(this);
    }
    return -1;
  }

  format(name: string, value: string) {
    if (name === TableCell.blotName && value) {
      this.domNode.setAttribute('data-row', value);
    } else {
      super.format(name, value);
    }
  }

  row(): TableRow {
    return this.parent as TableRow;
  }

  rowOffset() {
    if (this.row()) {
      return this.row().rowOffset();
    }
    return -1;
  }

  table() {
    return this.row() && this.row().table();
  }
}

class TableRow extends Container {
  static blotName = 'table-row';
  static tagName = 'TR';

  
  constructor(scroll: any, domNode: any) {
    super(scroll, domNode);

    console.log('constructor called');
    console.log(this.children)
  }

  // @ts-expect-error
  next: this | null;

  checkMerge() {
    console.log('checkMerge - TableRow' )

    // @ts-expect-error
    if (super.checkMerge() && this.next.children.head != null) {
      // @ts-expect-error
      const thisHead = this.children.head.formats();
      // @ts-expect-error
      const thisTail = this.children.tail.formats();
      // @ts-expect-error
      const nextHead = this.next.children.head.formats();
      // @ts-expect-error
      const nextTail = this.next.children.tail.formats();
      return (
        thisHead.table === thisTail.table &&
        thisHead.table === nextHead.table &&
        thisHead.table === nextTail.table
      );
    }
    return false;
  }

  optimize(context: { [key: string]: any }) {
    console.log('optimize - table row' )
    super.optimize(context);
    this.children.forEach((child: any) => {
      if (child.next == null) return;
      const childFormats = child.formats();
      const nextFormats = child.next.formats();
      if (childFormats.table !== nextFormats.table) {
        const next = this.splitAfter(child);
        if (next) {
          // @ts-expect-error TODO: parameters of optimize() should be a optional
          next.optimize();
        }
        // We might be able to merge with prev now
        if (this.prev) {
          // @ts-expect-error TODO: parameters of optimize() should be a optional
          this.prev.optimize();
        }
      }
    });
  }

  rowOffset() {
    if (this.parent) {
      return this.parent.children.indexOf(this);
    }
    return -1;
  }

  table() {
    return this.parent && this.parent.parent;
  }
}

class TableBody extends Container {
  static blotName = 'table-body';
  static tagName = 'TBODY';
}

class TableContainer extends Container {
  static blotName = 'table-container';
  static tagName = 'TABLE';

  checkMerge() {
    console.log('checkMerge - TableRow' )

    console.log('this.children.tail as any).children.tail?.children.tail')
    console.log((this.children.tail as any).children.tail?.children.tail)

    
    // @ts-expect-error
    if (super.checkMerge() && this.next.children.head != null) {
      // this is the current table 
      // this.children.tail -> tbody
      // this.children.tail.children.tail -> th
      // this.children.tail.children.tail.children.tail -> td
      const thisTableId = (this.children.tail as any).children.tail?.children.tail.formats().table

      const nextTableId =  (this.next?.children.tail as any).children.tail?.children.tail.formats().table

      if (thisTableId.split('-')[0] === nextTableId.split('-')[0]) {
        return true
      }
      
    }
    return false;
  }

  optimize(context: { [key: string]: any }) {
    console.log('optimize - TableContainer' )
    super.optimize(context);
    // this.children.forEach((child: any) => {
    //   if (child.next == null) return;
    //   const childFormats = child.formats();
    //   const nextFormats = child.next.formats();
    //   if (childFormats.table !== nextFormats.table) {
    //     const next = this.splitAfter(child);
    //     if (next) {
    //       // @ts-expect-error TODO: parameters of optimize() should be a optional
    //       next.optimize();
    //     }
    //     // We might be able to merge with prev now
    //     if (this.prev) {
    //       // @ts-expect-error TODO: parameters of optimize() should be a optional
    //       this.prev.optimize();
    //     }
    //   }
    // });
  }

  balanceCells() {
    console.log('balanceCells - TableContainer' )
    const rows = this.descendants(TableRow);
    const maxColumns = rows.reduce((max, row) => {
      return Math.max(row.children.length, max);
    }, 0);
    rows.forEach((row) => {
      new Array(maxColumns - row.children.length).fill(0).forEach(() => {
        let value;
        if (row.children.head != null) {
          
          value = TableCell.formats(((row.children.head) as TableBody).domNode);
        }
        const blot = this.scroll.create(TableCell.blotName, value);
        row.appendChild(blot);
        // @ts-expect-error TODO: parameters of optimize() should be a optional
        blot.optimize(); // Add break blot
      });
    });
  }

  cells(column: number) {
    return this.rows().map((row: any) => row.children.at(column));
  }

  deleteColumn(index: number) {
    // @ts-expect-error
    const [body] = this.descendant(TableBody) as TableBody[];
    if (body == null || body.children.head == null) return;
    body.children.forEach((row: any) => {
      const cell = row.children.at(index);
      if (cell != null) {
        cell.remove();
      }
    });
  }

  insertColumn(index: number) {
    // @ts-expect-error
    const [body] = this.descendant(TableBody) as TableBody[];
    if (body == null || body.children.head == null) return;
    body.children.forEach((row: any) => {
      const ref = row.children.at(index);
      
      const value = TableCell.formats(row.children.head.domNode);
      const cell = this.scroll.create(TableCell.blotName, value);
      row.insertBefore(cell, ref);
    });
  }

  insertRow(index: number) {
    // @ts-expect-error
    const [body] = this.descendant(TableBody) as TableBody[];
    if (body == null || body.children.head == null) return;

    // body.children.head -> TR
    // body.children.head.children.first -> TD

    const currentTableRowId = ((body.children.head as any).children as any).head.formats()?.table;
    const tableId = currentTableRowId.split('-');

    const id = tableRowId(tableId);
    const row = this.scroll.create(TableRow.blotName) as TableRow;
    (body.children.head as any).children.forEach(() => {
      const cell = this.scroll.create(TableCell.blotName, id);
      row.appendChild(cell);
    });
    const ref = body.children.at(index);
    body.insertBefore(row, ref);
  }

  rows() {
    const body = this.children.head as any;
    if (body == null) return [];
    return body.children.map((row: any) => row);
  }
}

TableContainer.allowedChildren = [TableBody];
TableBody.requiredContainer = TableContainer;

TableBody.allowedChildren = [TableRow];
TableRow.requiredContainer = TableBody;

TableRow.allowedChildren = [TableCell];
TableCell.requiredContainer = TableRow;

function tableRowId(tableId: string) {
  const id = Math.random().toString(36).slice(2, 6);
  return `${tableId}-row-${id}`;
}

export { TableCell, TableRow, TableBody, TableContainer, tableRowId };