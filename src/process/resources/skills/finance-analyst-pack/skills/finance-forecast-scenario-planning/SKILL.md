---
name: finance-forecast-scenario-planning
description: Build rolling forecasts and bull/base/bear scenarios from explicit business drivers instead of opaque spreadsheet momentum.
compatibility:
  - 'Works best when the user needs forward-looking financial planning, reforecasting, or scenario modeling.'
  - 'Useful for budget refreshes, operating planning, cash outlook, and management decision support.'
---

# Finance Forecast Scenario Planning

Use this skill when the output needs to support planning, not just explain the past.

## Use when

- The user needs a forecast, reforecast, or scenario view.
- Assumption changes must be visible.
- Finance and operating teams need a forward-looking planning narrative.

## Do not use when

- The task is only backward-looking variance explanation.
- There are no usable drivers.
- The user only wants spreadsheet formatting help.

## Forecasting principles

- Model from drivers when possible.
- Separate assumptions from calculations.
- Use scenarios instead of a single fragile forecast.
- Avoid hockey-stick assumptions unless they are clearly justified.

## Workflow

### 1. Identify the drivers

Possible drivers include:

- volume
- price
- customer count
- ARPU
- churn
- headcount
- gross margin
- cash conversion

### 2. Build the base case

The base case should be the most defensible path, not the most optimistic path.

### 3. Stress the plan

Create:

- bull case
- base case
- bear case

Say exactly which assumptions change across cases.

### 4. Translate the forecast into decisions

The answer should show:

- what the plan implies
- where the forecast is most fragile
- which assumptions are most worth monitoring

## Output format

Return:

### 1. Driver frame

- main drivers used
- missing inputs
- planning horizon

### 2. Scenario view

- bull
- base
- bear

### 3. Planning implications

- revenue, margin, or cash outlook
- biggest forecast risks
- next monitoring points

## Use together with

- `finance-budget-variance-analysis`
- `finance-saas-metrics`
- `office-duckdb-query`
