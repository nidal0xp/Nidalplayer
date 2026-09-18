/**
 * High-performance virtualized grid & list scroller.
 * Maintains a constant, low number of DOM nodes regardless of whether items.length is 100 or 100,000.
 */
export class VirtualScroller {
  constructor({
    container,
    itemHeight = 80,
    minItemWidth = 180,
    renderItem,
    gap = 12,
    mode = 'grid' // 'grid' | 'list'
  }) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.minItemWidth = minItemWidth;
    this.renderItem = renderItem;
    this.gap = gap;
    this.mode = mode;

    this.items = [];
    this.columns = 1;
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.viewportWidth = 0;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'virtual-wrapper';
    this.wrapper.style.position = 'relative';
    this.wrapper.style.width = '100%';
    this.wrapper.style.overflow = 'hidden';

    this.container.innerHTML = '';
    this.container.appendChild(this.wrapper);

    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.container.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize);

    this.recalculateDimensions();
  }

  destroy() {
    this.container.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    this.wrapper.innerHTML = '';
  }

  recalculateDimensions() {
    this.viewportHeight = this.container.clientHeight || window.innerHeight;
    this.viewportWidth = this.container.clientWidth || window.innerWidth;

    if (this.mode === 'grid') {
      const availableWidth = this.viewportWidth;
      const count = Math.floor((availableWidth + this.gap) / (this.minItemWidth + this.gap));
      this.columns = Math.max(1, count);
    } else {
      this.columns = 1;
    }
  }

  setItems(items) {
    this.items = items || [];
    this.recalculateDimensions();
    this.render();
  }

  scrollToTop() {
    this.container.scrollTop = 0;
    this.scrollTop = 0;
    this.render();
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    requestAnimationFrame(() => this.render());
  }

  handleResize() {
    this.recalculateDimensions();
    this.render();
  }

  render() {
    if (!this.items || this.items.length === 0) {
      this.wrapper.style.height = '0px';
      this.wrapper.innerHTML = '';
      return;
    }

    const totalItems = this.items.length;
    const cols = this.columns;
    const rowHeight = this.itemHeight + this.gap;
    const totalRows = Math.ceil(totalItems / cols);
    const totalHeight = totalRows * rowHeight;

    this.wrapper.style.height = `${totalHeight}px`;

    const startRow = Math.max(0, Math.floor(this.scrollTop / rowHeight) - 2);
    const visibleRowCount = Math.ceil(this.viewportHeight / rowHeight) + 4;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);

    const startIndex = Math.max(0, startRow * cols);
    const endIndex = Math.min(totalItems, endRow * cols);

    const fragment = document.createDocumentFragment();

    const itemWidth = cols > 1
      ? `calc((100% - ${(cols - 1) * this.gap}px) / ${cols})`
      : '100%';

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      if (!item) continue;

      const rowIndex = Math.floor(i / cols);
      const colIndex = i % cols;
      const top = rowIndex * rowHeight;

      const element = this.renderItem(item, i);
      element.style.position = 'absolute';
      element.style.top = `${top}px`;
      element.style.height = `${this.itemHeight}px`;
      element.style.width = itemWidth;

      if (cols > 1) {
        element.style.left = `calc(${colIndex} * (${itemWidth} + ${this.gap}px))`;
      } else {
        element.style.left = '0px';
      }

      fragment.appendChild(element);
    }

    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(fragment);
  }
}
