export const products = [
  {
    id: "cherry",
    name: "樱桃野餐",
    price: 39,
    subtitle: "把晴天系在脖子上",
    color: "#f5d9d2",
    asset: "/assets/cherry.png",
    detail: "奶油白底、红色樱桃印花，红色包边",
  },
  {
    id: "sky",
    name: "晴空格格",
    price: 39,
    subtitle: "清清爽爽的蓝色心情",
    color: "#d9e9ee",
    asset: "/assets/sky.png",
    detail: "浅蓝和白色细格纹，深蓝色包边",
  },
  {
    id: "daisy",
    name: "雏菊午后",
    price: 42,
    subtitle: "带一朵小花出门",
    color: "#f2e7bb",
    asset: "/assets/daisy.png",
    detail: "暖黄色面料、白色雏菊印花，奶白色包边",
  },
  {
    id: "forest",
    name: "森林散步",
    price: 42,
    subtitle: "和小树一起去冒险",
    color: "#dce7d8",
    asset: "/assets/forest.png",
    detail: "鼠尾草绿底、深绿叶片印花，深绿色包边",
  },
] as const;

export type Product = (typeof products)[number];
