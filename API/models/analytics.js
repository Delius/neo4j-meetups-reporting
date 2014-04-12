/**
 *  neo4j movie functions
 *  these are mostly written in a functional style
 */


var _ = require('underscore');
var uuid = require('hat'); // generates uuids
var Cypher = require('../neo4j/cypher');
var Analytics = require('../models/neo4j/analytics');
var async = require('async');
var randomName = require('random-name');

/**
 *  Result Functions
 *  to be combined with queries using _.partial()
 */

 var _cities = function(results, callback) {
  var citiesArray = [];

  var cities = _.map(results, function (result) {
  var thisCities = {};
    thisCities.city = result.city;
    citiesArray.push(result.city);
    return thisCities;
  });

  callback(null, citiesArray);
};

 var _countries = function(results, callback) {
  var countriesArray = [];

  var countries = _.map(results, function (result) {
  var thisCountries = {};
    thisCountries.country = result.country;
    countriesArray.push(result.country);
    return thisCountries;
  });

  callback(null, countriesArray);
};

var _weeklyGrowthStatistics = function (results, callback) {
  var analytics = _.map(results, function (result) {
    var thisAnalytics = {};
    thisAnalytics.week = result.week;
    thisAnalytics.group = result.group;
    thisAnalytics.members = result.members;
    return thisAnalytics;
  });

  callback(null, analytics);
};

var _monthlyGrowthStatistics = function (results, callback) {
  var analytics = _.map(results, function (result) {
    var thisAnalytics = {};
    thisAnalytics.month = result.month;
    thisAnalytics.group = result.group;
    thisAnalytics.members = result.members;
    return thisAnalytics;
  });

  callback(null, analytics);
};

/**
 *  Query Functions
 *  to be combined with result functions using _.partial()
 */

var _getWeeklyGrowthPercent = function (params, options, callback) {
  var cypher_params = {
    startDate: params.startDate,
    endDate: params.endDate,
    city: params.city,
    topics: params.topics,
    groups: params.groups
  };
  var query = [
    'MATCH (dayStart:Day { day: { startDate }.day, month: { startDate }.month, year: { startDate }.year }),',
    '(dayEnd:Day { day: { endDate }.day, month: { endDate }.month, year: { endDate }.year })', 
    'MATCH (dayStart)-[:NEXT*0..]->(day:Day)-[:NEXT*0..]->(dayEnd),',
    '      (day)<-[:HAS_DAY]-(week:Week)',
    'WITH DISTINCT week',
    'MATCH (week)-[:HAS_DAY]->(day)<-[:ON_DAY]-(stats:Stats)<-[:HAS_MEMBERS]-(group:Group)-[:LOCATED_IN]->(location:Location),',
    '      (group)-[:HAS_TAG]->(tag:Tag)',
    'WHERE tag.tag in { topics }' + (params.city ? ' AND location.city = { city }' : '') + (params.groups.length > 0 ? ' AND group.name in { groups }' : ''),
    'WITH day, week, group, stats',
    'ORDER BY day.timestamp',
    'WITH week, head(collect(day)) as day, group, last(collect(stats)) as members',
    'WITH DISTINCT (day.month + "/" + day.day) as week, group.name as group, members.count as members, day',
    'ORDER BY day.timestamp',
    'RETURN week, group, members'
  ].join('\n');

  callback(null, query, cypher_params);
};

var _getMonthlyGrowthPercent = function (params, options, callback) {
  var cypher_params = {
    startDate: getTicks(params.startDate),
    endDate: getTicks(params.endDate),
    city: params.city,
    country: params.country,
    topics: params.topics,
    groups: params.groups
  };
  var query = [
    'MATCH (d:Day)<-[:HAS_DAY]-(month:Month)',
    'WHERE d.timestamp > { startDate } AND d.timestamp < { endDate }',
    'WITH DISTINCT month',
    'MATCH (month:Month)-[:HAS_DAY]->(day:Day { day: 1 })',
    'MATCH (tag:Tag), (location:Location)',
    'WHERE tag.tag in { topics }' + (params.city ? ' AND location.city = { city }' : '')  + (params.country ? ' AND location.country = { country }' : ''),
    'WITH tag, location, day',
    'MATCH (tag)-[:HAS_TAG]-(group:Group),',
    '      (group)-[:LOCATED_IN]->(location),',
    '      (group)-[:HAS_MEMBERS]->(stats:Stats)-[:ON_DAY]->(day)' + (params.groups.length > 0 ? ' WHERE group.name in { groups }' : ''),
    'WITH DISTINCT (day.month + "/" + day.day + "/" + day.year) as month, group.name as group, stats.count as members, day',
    'ORDER BY day.timestamp',
    'RETURN month, group, members'
  ].join('\n');

  callback(null, query, cypher_params);
};

var _getCities = function (params, options, callback) {

  var query = [
    'MATCH (location:Location)',
    'RETURN DISTINCT location.city as city'
  ].join('\n');

  callback(null, query, params);
};

var _getCountries = function (params, options, callback) {

  var query = [
    'MATCH (location:Location)',
    'RETURN DISTINCT location.country as country'
  ].join('\n');

  callback(null, query, params);
};


/**
 *  Result Function Wrappers
 *  a wrapper function that combines both the result functions with query functions
 */

var getWeeklyGrowthPercent = Cypher(_getWeeklyGrowthPercent, _weeklyGrowthStatistics);
var getMonthlyGrowthPercent = Cypher(_getMonthlyGrowthPercent, _monthlyGrowthStatistics);
var getCities = Cypher(_getCities, _cities);
var getCountries = Cypher(_getCountries, _countries);

// export exposed functions
module.exports = {
  getWeeklyGrowthPercent: getWeeklyGrowthPercent,
  getMonthlyGrowthPercent: getMonthlyGrowthPercent,
  getCities: getCities,
  getCountries: getCountries
};

function getTicks(dateTime)
{

  var ticks = ((dateTime.getTime() * 10000) + 621355968000000000);

  return ticks;
}