<script>
  import { Router, Link } from './router/index.js'
  import Feed from './pages/Feed.svelte'
  import PostDetail from './pages/PostDetail.svelte'
  import Profile from './pages/Profile.svelte'
  import Messages from './pages/Messages.svelte'
  import NewPost from './pages/NewPost.svelte'
  import NotFound from './pages/NotFound.svelte'
</script>

<Router routes={{
  '/': Feed,
  '/posts/:id': PostDetail,
  '/profile/:address': Profile,
  '/messages': Messages,
  '/new': NewPost,
}} fallback={NotFound}>
  <nav>
    <Link href="/">Feed</Link>
  </nav>
</Router>
