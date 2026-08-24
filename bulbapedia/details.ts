import * as cheerio from 'cheerio'

const pokBaseUrl = 'https://bulbapedia.bulbagarden.net/wiki/{0}(Pok%C3%A9mon)'


async function fetchInfo(name: string) {
    const pokUrl = pokBaseUrl.replace('{0}', name.replaceAll(' ', '_'))
    const pokHtml = await fetch(pokUrl).then(res => res.text())
    const $ = cheerio.load(pokHtml)

    const formsHeading = $('h3#Forms')
    const formsTable = formsHeading.next('table')

}

const pok = await fetchInfo('Arceus')