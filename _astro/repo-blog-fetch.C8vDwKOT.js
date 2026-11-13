import{t as e}from"./post-lock.B-8TPFc-.js";import{i as t,o as n}from"./owner-session.B3aGXWHX.js";import{c as r,i,s as a,t as o}from"./repo-blog-files.BSuYkiFA.js";async function s(r,i,a){let[o,s]=i.split(`/`);if(!o||!s)return null;let c=await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:n(r,{"Content-Type":`application/json`}),cache:`no-store`,body:JSON.stringify({query:`query ($owner: String!, $name: String!, $expr: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $expr) {
            ... on Tree {
              entries {
                name
                type
                object { ... on Blob { text isTruncated } }
              }
            }
          }
        }
      }`,variables:{owner:o,name:s,expr:`${a}:${e}`}})});if(!c.ok)return null;let l=await c.json();if(l.errors?.length||!l.data?.repository?.object?.entries)return null;let u=[],d=[];for(let t of l.data.repository.object.entries){if(t.type!==`blob`||!t.name.endsWith(`.md`))continue;let n=`${e}/${t.name}`;t.object?.isTruncated||t.object?.text==null?d.push(n):u.push({path:n,content:t.object.text})}if(d.length){let e=await Promise.all(d.map(async e=>({path:e,content:await t(r,i,e,a)})));u.push(...e)}return u}async function c(r,i,a){let o=await fetch(`https://api.github.com/repos/${i}/contents/${e}?ref=${encodeURIComponent(a)}`,{headers:n(r),cache:`no-store`});if(!o.ok)throw Error(`글 목록을 가져오지 못했습니다. 토큰 권한을 확인해 주세요.`);let s=await o.json(),c=(Array.isArray(s)?s:[]).filter(e=>e.type===`file`&&e.name.endsWith(`.md`));return Promise.all(c.map(async e=>({path:e.path,content:await t(r,i,e.path,a)})))}async function l(e,t,n=`main`){if(!e)throw Error(`저장소 주인 토큰이 있어야 글 목록을 가져올 수 있습니다.`);let r=await s(e,t,n).catch(()=>null)??await c(e,t,n);return a(r)}function u(e,t){try{let n=sessionStorage.getItem(o);if(!n)return null;let r=JSON.parse(n);return!r||r.repo!==e||r.ref!==t||!Array.isArray(r.posts)?null:r.posts.map(i)}catch{return null}}function d(e,t,n){try{let i={repo:e,ref:t,posts:n.map(r)};sessionStorage.setItem(o,JSON.stringify(i))}catch{}}async function f(e,t,n=`main`){let r=u(t,n);if(r)return r;let i=await l(e,t,n);return d(t,n,i),i}export{f as t};