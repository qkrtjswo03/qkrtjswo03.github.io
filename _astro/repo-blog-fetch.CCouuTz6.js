import{i as e,o as t}from"./owner-session.B3aGXWHX.js";import{a as n,c as r,l as i,n as a,t as o}from"./repo-blog-files.BlMnzEu5.js";async function s(n,r,i){let[a,s]=r.split(`/`);if(!a||!s)return null;let c=await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:t(n,{"Content-Type":`application/json`}),cache:`no-store`,body:JSON.stringify({query:`query ($owner: String!, $name: String!, $expr: String!) {
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
      }`,variables:{owner:a,name:s,expr:`${i}:${o}`}})});if(!c.ok)return null;let l=await c.json();if(l.errors?.length||!l.data?.repository?.object?.entries)return null;let u=[],d=[];for(let e of l.data.repository.object.entries){if(e.type!==`blob`||!e.name.endsWith(`.md`))continue;let t=`${o}/${e.name}`;e.object?.isTruncated||e.object?.text==null?d.push(t):u.push({path:t,content:e.object.text})}if(d.length){let t=await Promise.all(d.map(async t=>({path:t,content:await e(n,r,t,i)})));u.push(...t)}return u}async function c(n,r,i){let a=await fetch(`https://api.github.com/repos/${r}/contents/${o}?ref=${encodeURIComponent(i)}`,{headers:t(n),cache:`no-store`});if(!a.ok)throw Error(`글 목록을 가져오지 못했습니다. 토큰 권한을 확인해 주세요.`);let s=await a.json(),c=(Array.isArray(s)?s:[]).filter(e=>e.type===`file`&&e.name.endsWith(`.md`));return Promise.all(c.map(async t=>({path:t.path,content:await e(n,r,t.path,i)})))}async function l(e,t,n=`main`){if(!e)throw Error(`저장소 주인 토큰이 있어야 글 목록을 가져올 수 있습니다.`);let i=await s(e,t,n).catch(()=>null)??await c(e,t,n);return r(i)}function u(e,t){try{let r=sessionStorage.getItem(a);if(!r)return null;let i=JSON.parse(r);return!i||i.repo!==e||i.ref!==t||!Array.isArray(i.posts)?null:i.posts.map(n)}catch{return null}}function d(e,t,n){try{let r={repo:e,ref:t,posts:n.map(i)};sessionStorage.setItem(a,JSON.stringify(r))}catch{}}async function f(e,t,n=`main`){let r=u(t,n);if(r)return r;let i=await l(e,t,n);return d(t,n,i),i}export{f as t};