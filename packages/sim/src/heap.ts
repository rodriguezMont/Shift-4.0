/** Binary min-heap ordered by `compare` (negative means `a` comes first). */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top !== undefined && last !== undefined && this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    let child = index;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (!this.precedes(child, parent)) return;
      this.swap(child, parent);
      child = parent;
    }
  }

  private siftDown(index: number): void {
    let parent = index;
    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let first = parent;
      if (left < this.items.length && this.precedes(left, first)) first = left;
      if (right < this.items.length && this.precedes(right, first)) first = right;
      if (first === parent) return;
      this.swap(parent, first);
      parent = first;
    }
  }

  private precedes(a: number, b: number): boolean {
    return this.compare(this.items[a] as T, this.items[b] as T) < 0;
  }

  private swap(a: number, b: number): void {
    const item = this.items[a] as T;
    this.items[a] = this.items[b] as T;
    this.items[b] = item;
  }
}
