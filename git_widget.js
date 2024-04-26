const STYLE = {
  FULL: 'full',
  SMALL: 'small',
  TEXT: 'text'
}

const SORT = {
  NONE: 'none',
  DATE: 'date'
}

function init () {
  const repoList = QueryManager.getRepoList()
  renderRepos(repoList, document.getElementById('container'))
  Controls.renderControls('#controls')
  Controls.renderFooter('footer')
}

async function renderRepos (repos, containerElement) {
  if (!Array.isArray(repos)) {
    console.error('Invalid input: repos is not an array')
    return
  }
  const fetchPromises = repos.map(repoString => {
    const widget = new Widget(repoString)
    return widget.initialize()
  })

  const results = await Promise.all(fetchPromises)
  const sortByDate = QueryManager.getSort() === SORT.DATE
  if (sortByDate) {
    results.sort((a, b) => new Date(a.commitDate) < new Date(b.commitDate))
  }

  const innerContainerElement = Widget.getContainerElement(QueryManager.getStyle())
  results.forEach(result => {
    if (result.widgetElement) {
      innerContainerElement.appendChild(result.widgetElement)
    }
  })
  containerElement.appendChild(innerContainerElement)
}

class Repo {
  constructor (user, repo) {
    this.user = user
    this.repo = repo
    this.repoString = `${user}/${repo}`
    this.elementId = `git-widget|${encodeURIComponent(user)}|${encodeURIComponent(repo)}`
  }

  getElementId () {
    return this.elementId
  }

  getUser () {
    return this.user
  }

  getRepo () {
    return this.repo
  }

  getRepoString () {
    return this.repoString
  }

  removeRepo () {
    QueryManager.removeRepoFromList(this.repoString)
    const element = document.getElementById(this.elementId)
    if (element) {
      element.remove()
    }
  }

  static fromElementId (elementId) {
    const parts = elementId.split('|') // git-widget|user|repo
    const user = decodeURIComponent(parts[1])
    const repo = decodeURIComponent(parts[2])
    return new Repo(user, repo)
  }

  static fromString (repoString) {
    const [user, repo] = repoString.split('/')
    return new Repo(user, repo)
  }

  static removeRepoByElementId (elementId) {
    const repo = Repo.fromElementId(elementId)
    repo.removeRepo()
  }
}

class Widget {
  constructor (repoString) {
    this.repo = Repo.fromString(repoString)
  }

  async initialize () {
    try {
      const commits = await this.fetchLastCommit()
      if (commits.length > 0) {
        const widgetElement = this.render(commits[0])
        return { elementId: this.repo.getElementId(), commitDate: commits[0].commit.author.date, widgetElement }
      } else {
        console.error('No commit data available')
        this.repo.removeRepo()
      }
    } catch (error) {
      console.error('Error fetching commit data:', error)
      this.repo.removeRepo()
    }
  }

  async fetchLastCommit () {
    try {
      const response = await fetch(`https://api.github.com/repos/${this.repo.getUser()}/${this.repo.getRepo()}/commits`)
      if (!response.ok) {
        throw new Error('Failed to load data: ' + response.statusText)
      }
      return await response.json()
    } catch (error) {
      throw new Error('Network error: ' + error.message)
    }
  }

  render (commitData) {
    const style = QueryManager.getStyle()
    switch (style) {
      case STYLE.TEXT:
        return this.renderText(commitData)
      case STYLE.SMALL:
        return this.renderSmall(commitData)
      case STYLE.FULL:
      default:
        return this.renderFull(commitData)
    }
  }

  renderFull (commitData) {
    const element = document.createElement('div')
    element.id = this.repo.getElementId()
    element.className = 'repo-widget'
    element.innerHTML = `
      <div class="repo-title">
          <h3><a href="https://github.com/${this.repo.getUser()}/${this.repo.getRepo()}" target="_blank">${this.repo.getRepoString()}</a></h3>
          <button onclick="Repo.removeRepoByElementId('${this.repo.getElementId()}')">X</button>
      </div>
      <div class="commit-date">
          <span class="human-date">${Utils.timeAgo(commitData.commit.author.date)}</span>
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
    return element
  }

  renderSmall (commitData) {
    const element = document.createElement('div')
    element.id = this.repo.getElementId()
    element.className = 'repo-widget small'
    element.innerHTML = `
      <div class="repo-title">
          <h3><a href="https://github.com/${this.repo.getUser()}/${this.repo.getRepo()}" target="_blank">${this.repo.getRepoString()}</a></h3>
          <button onclick="Repo.removeRepoByElementId('${this.repo.getElementId()}')">X</button>
      </div>
      <div class="commit-info">
          <span class="human-date">${Utils.timeAgo(commitData.commit.author.date)}</span> - 
          <a href="${commitData.html_url}" target="_blank">${commitData.sha}</a>
      </div>
    `
    return element
  }

  renderText (commitData) {
    const element = document.createElement('li')
    element.id = this.repo.getElementId()
    element.className = 'repo-text-list-item'
    element.innerHTML = `
      <span class="repo-name">
        <a href="https://github.com/${this.repo.getUser()}/${this.repo.getRepo()}" target="_blank">
          ${this.repo.getRepoString()}
        </a>
      </span> - <span class="commit-date">
        <a href="${commitData.html_url}" target="_blank">
          ${Utils.timeAgo(commitData.commit.author.date)}
        </a>
      </span> - <a href="#" onclick="Repo.removeRepoByElementId('${this.repo.getElementId()}')">[X]</a>
    `
    return element
  }

  static getContainerElement (style) {
    let element = null
    if (style === STYLE.TEXT) {
      element = document.createElement('ul')
    } else {
      element = document.createElement('div')
    }
    element.className = `widget-container ${style}`
    return element
  }
}

class Controls {
  static renderControls (containerSelector) {
    const container = document.querySelector(containerSelector)
    const inputWrapper = document.createElement('div')
    inputWrapper.className = 'add-repo-wrapper'

    const input = Controls.createInput()
    const reloadOrAddButton = Controls.createAddButton(input, container)
    const styleDropdown = Controls.createStyleDropdown()

    input.addEventListener('keyup', event => {
      reloadOrAddButton.textContent = input.value ? 'Add Repo' : 'Reload'
      if (event.key === 'Enter') {
        Controls.inputButtonListener(input, container)
      }
    })

    inputWrapper.appendChild(input)
    inputWrapper.appendChild(reloadOrAddButton)
    inputWrapper.appendChild(styleDropdown)
    container.appendChild(inputWrapper)
  }

  static createInput () {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Enter "user/repo" to add or leave empty to reload'
    input.className = 'repo-input'
    return input
  }

  static createAddButton (input, container) {
    const addButton = document.createElement('button')
    addButton.textContent = 'Reload' // Default text
    addButton.onclick = () => Controls.inputButtonListener(input, container)
    return addButton
  }

  static createStyleDropdown () {
    const styleDropdown = document.createElement('select')
    const options = Object.values(STYLE)
    options.forEach(option => {
      const optionElement = document.createElement('option')
      optionElement.value = option
      optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1)
      styleDropdown.appendChild(optionElement)
    })

    styleDropdown.value = QueryManager.getStyle()
    styleDropdown.onchange = () => {
      QueryManager.setStyle(styleDropdown.value)
    }

    return styleDropdown
  }

  static inputButtonListener (input, container) {
    const repoString = input.value
    if (!repoString) {
      window.location.reload() // Reload the page if the input is empty
    } else if (repoString.includes('/')) {
      QueryManager.addRepoToList(repoString)
      const repoList = QueryManager.getRepoList()
      renderRepos(repoList, container)
      input.value = '' // Clear input after adding
    } else {
      window.alert('Please enter a valid "user/repo" string.')
    }
  }

  static renderFooter (footerSelector) {
    const footer = document.querySelector(footerSelector)
    const fragment = document.createDocumentFragment()

    const labelDiv = document.createElement('div')
    labelDiv.textContent = 'Click to copy shareable link:'
    fragment.appendChild(labelDiv)

    const urlInput = document.createElement('input')
    urlInput.type = 'text'
    urlInput.value = QueryManager.buildUrl()
    urlInput.readOnly = true
    urlInput.className = 'shareable-link'
    urlInput.onclick = () => {
      urlInput.select()
      navigator.clipboard.writeText(urlInput.value)
        .then(() => console.log('Text copied to clipboard'))
        .catch(err => console.error('Failed to copy text: ', err))
    }
    fragment.appendChild(urlInput)

    footer.innerHTML = ''
    footer.appendChild(fragment)
  }
}

class QueryManager {
  static getQueryStringParam (param) {
    const urlParams = new URLSearchParams(window.location.search)
    const value = urlParams.get(param)
    return value ? (param === 'repoList' ? JSON.parse(value) : value) : null
  }

  static setQueryStringParam (param, value) {
    const urlParams = new URLSearchParams(window.location.search)
    if (param === 'repoList') {
      value = JSON.stringify(value)
    }
    urlParams.set(param, value)
    window.location.search = urlParams.toString()
  }

  static getRepoList () {
    return QueryManager.getQueryStringParam('repoList') || []
  }

  static addRepoToList (repoString) {
    const repoList = QueryManager.getRepoList()
    if (!repoList.includes(repoString)) {
      repoList.push(repoString)
      QueryManager.setQueryStringParam('repoList', repoList)
    }
  }

  static removeRepoFromList (repoString) {
    let repoList = QueryManager.getRepoList()
    repoList = repoList.filter(repo => repo !== repoString)
    QueryManager.setQueryStringParam('repoList', repoList)
  }

  static getStyle () {
    return QueryManager.getQueryStringParam('style') || STYLE.FULL
  }

  static setStyle (style) {
    QueryManager.setQueryStringParam('style', style)
  }

  static getSort () {
    return QueryManager.getQueryStringParam('sort') || SORT.NONE
  }

  static setSort (sortType) {
    QueryManager.setQueryStringParam('sort', sortType)
  }

  static buildUrl () {
    const url = new URL(window.location)
    url.search = new URLSearchParams(window.location.search)
    return url.toString()
  }
}

class Utils {
  static timeAgo (input) {
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
}
