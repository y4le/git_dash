function fetchLastCommit (username, repo) {
  return fetch(`https://api.github.com/repos/${username}/${repo}/commits`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load data: ' + response.statusText)
      }
      return response.json()
    })
    .catch(error => {
      throw new Error('Network error: ' + error.message)
    })
}

function renderLastCommit (elementId, commitData) {
  const element = document.getElementById(elementId)
  if (!element) {
    console.error('Element not found:', elementId)
    return
  }
  const [username, repo] = elementId.replace('git-widget-', '').split('-')
  const collapsed = new URLSearchParams(window.location.search).get('collapsed') === 'true'
  const sortByDate = new URLSearchParams(window.location.search).get('sort') === 'date'
  element.className = collapsed ? 'repo-widget collapsed' : 'repo-widget'
  element.innerHTML = `
    <div class="repo-title">
        <h3><a href="https://github.com/${username}/${repo}" target="_blank">${username}/${repo}</a></h3>
        <button onclick="removeRepo('${elementId}')">X</button>
    </div>
    <div class="commit-date">
        <a href="${commitData.html_url}" target="_blank"class="human-date">${timeAgo(commitData.commit.author.date)}</a>
        <span class="iso-date"> - ${commitData.commit.author.date}</span>
    </div>
    <div class="commit-sha">
        <a href="${commitData.html_url}" target="_blank">${commitData.sha}</a>
    </div>
    <div class="commit-author">
        <a href="${commitData.author.html_url}" target="_blank">${commitData.commit.author.name}</a>
    </div>
    <div class="commit-message-wrapper">
        <span class="commit-message">${commitData.commit.message}</span>
    </div>
  `

  if (sortByDate) {
    element.dataset.commitDate = commitData.commit.author.date
    sortElementsByDate()
  }
}

function sortElementsByDate () {
  const container = document.querySelector('#container')
  Array.from(container.children)
    .sort((a, b) => {
      return new Date(a.dataset.commitDate) < new Date(b.dataset.commitDate)
    })
    .forEach(widget => container.appendChild(widget))
}

function removeRepo (elementId) {
  const [username, repo] = elementId.replace('git-widget-', '').split('-')
  const repoString = `${username}/${repo}`
  removeRepoFromList(repoString)
  document.getElementById(elementId).remove()
}

function initGitWidget (elementId, username, repo) {
  fetchLastCommit(username, repo)
    .then(commits => {
      if (commits.length > 0) {
        renderLastCommit(elementId, commits[0])
      } else {
        console.error('No commit data available')
        removeRepo(elementId)
      }
    })
    .catch(error => {
      console.error('Error fetching commit data:', error)
      removeRepo(elementId)
    })
}

function renderRepos (repos, containerElement) {
  if (!Array.isArray(repos)) {
    console.error('Invalid input: repos is not an array')
    return
  }
  repos.forEach(repoString => {
    const [username, repo] = repoString.split('/')
    const widgetId = `git-widget-${username}-${repo}`
    let widgetElement = document.getElementById(widgetId)

    if (!widgetElement) {
      widgetElement = document.createElement('div')
      widgetElement.id = widgetId
      containerElement.appendChild(widgetElement)
    }

    initGitWidget(widgetId, username, repo)
  })
}

function renderControls (containerId) {
  const container = document.getElementById(containerId)
  const inputWrapper = document.createElement('div')
  inputWrapper.className = 'add-repo-wrapper'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'Enter "user/repo" to add or leave empty to reload'
  input.className = 'repo-input'

  const addButton = document.createElement('button')
  addButton.textContent = 'Reload' // Default text
  addButton.onclick = () => addRepoFunction(input, container)

  const toggleButton = document.createElement('button')
  const params = new URLSearchParams(window.location.search)
  const isCollapsed = params.get('collapsed') === 'true'
  toggleButton.textContent = isCollapsed ? 'Expand' : 'Collapse'
  toggleButton.onclick = () => {
    params.set('collapsed', !isCollapsed)
    window.location.search = params.toString()
    toggleButton.textContent = !isCollapsed ? 'Expand' : 'Collapse'
  }
  input.addEventListener('keyup', event => {
    addButton.textContent = input.value ? 'Add Repo' : 'Reload'
    if (event.key === 'Enter') {
      addRepoFunction(input, container)
    }
  })

  inputWrapper.appendChild(input)
  inputWrapper.appendChild(addButton)
  inputWrapper.appendChild(toggleButton)
  container.appendChild(inputWrapper)
}

function addRepoFunction (input, container) {
  const repoString = input.value
  if (!repoString) {
    location.reload() // Reload the page if the input is empty
  } else if (repoString.includes('/')) {
    addRepoToList(repoString)
    const repoList = getRepoList()
    renderRepos(repoList, container)
    input.value = '' // Clear input after adding
  } else {
    alert('Please enter a valid "user/repo" string.')
  }
}

function getRepoList () {
  const urlParams = new URLSearchParams(window.location.search)
  const repoListParam = urlParams.get('repoList')
  return repoListParam ? JSON.parse(repoListParam) : []
}

function addRepoToList (repoString) {
  const repoList = getRepoList()
  if (!repoList.includes(repoString)) {
    repoList.push(repoString)
    updateQueryString(repoList)
  }
}

function removeRepoFromList (repoString) {
  let repoList = getRepoList()
  repoList = repoList.filter(repo => repo !== repoString)
  updateQueryString(repoList)
}

function updateQueryString (repoList) {
  const urlParams = new URLSearchParams(window.location.search)
  urlParams.set('repoList', JSON.stringify(repoList))
  window.location.search = urlParams.toString()
}

function timeAgo (input) {
  // https://stackoverflow.com/a/69122877
  const date = (input instanceof Date) ? input : new Date(input)
  const formatter = new Intl.RelativeTimeFormat('en')
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  }
  const secondsElapsed = (date.getTime() - Date.now()) / 1000
  for (const key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key]
      return formatter.format(Math.round(delta), key)
    }
  }
}

function init () {
  const containerElement = document.getElementById('container')
  const repoList = getRepoList()
  console.warn(repoList)
  renderRepos(repoList, containerElement)
  renderControls('controls')
}
