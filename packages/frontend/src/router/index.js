import Router from './Router.svelte'
import Link from './Link.svelte'

let _navigate = null

function navigate(path) {
  if (_navigate) {
    _navigate(path)
  } else {
    window.location.href = path
  }
}

function setNavigate(fn) {
  _navigate = fn
}

export { Router, Link, navigate, setNavigate }
