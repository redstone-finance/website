/// <reference types="cypress" />
import 'cypress-wait-until';
import Arweave from 'arweave';
let arweave = Arweave.init({});

function createRandomWord(length) {
  var consonants = 'bcdfghjlmnpqrstv',
      vowels = 'aeiou',
      rand = function(limit) {
          return Math.floor(Math.random()*limit);
      },
      i, word='', length = parseInt(length,10),
      consonants = consonants.split(''),
      vowels = vowels.split('');
  for (i=0;i<length/2;i++) {
      var randConsonant = consonants[rand(consonants.length)],
          randVowel = vowels[rand(vowels.length)];
      word += (i===0) ? randConsonant.toUpperCase() : randConsonant;
      word += i*2<length-1 ? randVowel : '';
  }
  return word;
}

function generateWord() {
  return createRandomWord(Math.floor(Math.random() * 50 + 1));
}

context('Actions', () => {
  let walletContent;
  let addy;

  before(async () => {
      walletContent = await arweave.wallets.generate()
      addy = await arweave.wallets.jwkToAddress(walletContent);
  })

  // https://on.cypress.io/interacting-with-elements

  it('Step 1 - Set wallet', () => {
    cy.visit('http://localhost:5000/create')
    cy.get('.file-upload-default')
    .attachFile({
        fileContent: walletContent,
        fileName: `wallet.json`,
        mimeType: 'application/json'
    })
    cy.get('.continue').should('not.be.disabled')
    cy.get('.continue').click();
  });

  it('Step 2 - Community Details', () => {
    cy.scrollTo('bottom')

    cy.get('#communityname').type(generateWord())
    cy.get('#communityappurl').type(`https://${generateWord()}.com`)
    cy.get('#communitydesc').type(`${generateWord()} ${generateWord()} ${generateWord()}`)
    cy.get('#psttoken').type(createRandomWord(3))
    cy.get('.holder.form-control.border-danger').type(addy).should('not.have.class', 'border-danger')
    cy.get('.holder-balance').type(Math.floor(Math.random() * 100) + 1)
    cy.get('.continue').should('not.be.disabled')
    cy.get('.continue').click()
  })

  it('Step 3 - Community Settings', () => {
    cy.wait(2000)
    cy.get('.continue').should('not.be.disabled')
    cy.get('.continue').click()
  })

  it('Step 4 - Community Submit', () => {
    cy.scrollTo(0, 1000)
    cy.get('.form-check-input').click({multiple: true});
    cy.get('.continue').then($btn => $btn.removeAttr('disabled').addClass('btn-primary'));
    cy.get('.continue').click()
  })
})
