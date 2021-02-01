import 'bootstrap/dist/js/bootstrap.bundle';

import $ from './libs/jquery';
import './global';

$(() => {
  $('a.create').attr('href', './create.html');
  $('a.opp').attr('href', './opportunity.html');
  $('a.comms').attr('href', './communities.html');
});
