import { readFileSync } from 'node:fs';
import Yoga, { Align, Direction, Display, Edge, FlexDirection, Gutter, Justify, PositionType } from 'yoga-layout';

const { width, height, root } = JSON.parse(readFileSync(0, 'utf8'));

const lengths = [
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'aspectRatio',
];
const enums = { alignItems: Align, alignSelf: Align, display: Display, flexDirection: FlexDirection, justifyContent: Justify };
const edges = { '': Edge.All, Horizontal: Edge.Horizontal, Vertical: Edge.Vertical, Top: Edge.Top, Bottom: Edge.Bottom, Left: Edge.Left, Right: Edge.Right };
const pascal = (value) => value.replace(/(^|-)([a-z])/g, (_, prefix, letter) => letter.toUpperCase());

// Project the shell's host styles into layout nodes. Bounds come from Yoga's
// layout pass across the header, flex body and tab bar.
function build({ style = {}, children }) {
  const node = Yoga.Node.create();
  for (const key of lengths) {
    if (style[key] != null) node['set' + pascal(key)](style[key]);
  }
  for (const [key, values] of Object.entries(enums)) {
    if (style[key] != null) node['set' + pascal(key)](values[pascal(style[key])]);
  }
  if (style.position) node.setPositionType(PositionType[pascal(style.position)]);
  if (style.gap != null) node.setGap(Gutter.All, style.gap);
  for (const [suffix, edge] of Object.entries(edges)) {
    if (style['padding' + suffix] != null) node.setPadding(edge, style['padding' + suffix]);
    if (style['margin' + suffix] != null) node.setMargin(edge, style['margin' + suffix]);
    if (style['border' + suffix + 'Width'] != null) node.setBorder(edge, style['border' + suffix + 'Width']);
    const offset = style[suffix.toLowerCase()];
    if (offset != null) node.setPosition(edge, offset);
  }
  children.forEach((child, index) => node.insertChild(build(child), index));
  return node;
}

const bounds = {};
function readBounds({ testID, children }, node, parentTop = 0) {
  const top = parentTop + node.getComputedTop();
  if (testID) bounds[testID] = { top, height: node.getComputedHeight() };
  children.forEach((child, index) => readBounds(child, node.getChild(index), top));
}

const tree = build(root);
try {
  tree.calculateLayout(width, height, Direction.LTR);
  readBounds(root, tree);
  process.stdout.write(JSON.stringify(bounds));
} finally {
  tree.freeRecursive();
}
