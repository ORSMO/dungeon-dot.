'use strict';

function makeGameContext(report) {
  const noop = () => {};
  const canvas = new Proxy({}, {
    get: (target, key) => target[key] ?? (
      key === 'createRadialGradient' || key === 'createLinearGradient'
        ? () => ({addColorStop:noop}) : noop
    )
  });
  const nodes = new Map();
  const storage = new Map();
  function element() {
    return {
      hidden:true, style:{}, classList:{toggle:noop,add:noop,remove:noop}, dataset:{}, children:[],
      addEventListener:noop, setAttribute:noop, removeAttribute:noop, querySelector:find,
      querySelectorAll:()=>[], getContext:()=>canvas,
      getBoundingClientRect:()=>({width:1280,height:720,left:0,top:0}),
      appendChild(node){this.children.push(node);return node},
      append(...items){this.children.push(...items)},
      replaceChildren(){this.children=[]},
      get firstChild(){return this.children[0]},
      removeChild:noop
    };
  }
  function find(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  }
  const document = {querySelector:find,querySelectorAll:()=>[],createElement:element,addEventListener:noop,body:element()};
  const window = {addEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop})};
  const localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  return {document,window,localStorage,screen:{},requestAnimationFrame:noop,performance:{now:()=>0},setTimeout:noop,report};
}

module.exports = {makeGameContext};
