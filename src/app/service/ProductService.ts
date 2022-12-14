/* eslint-disable no-case-declarations */
import Logger from '../utils/loggers/winstonConfig'
import { Readable } from 'stream'
import BadRequestError from '../errors/BadRequestError'
import { Types } from 'mongoose'
import { IProductResponse, IProduct } from '../interfaces/IProduct'
import ProductRepository from '../repository/ProductRepository'
import NotFoundError from '../errors/NotFoundError'
import readline from 'readline'
import mapper from '../../mapper/mapper.json'

class ProductService {
  async create (payload: IProduct): Promise<IProductResponse> {
    const foundBarCode = await ProductRepository.getByBarCode(payload.bar_codes)
    if (foundBarCode) {
      Logger.error(`[POST /api/v1/product]: Bar code already exists: '${payload.bar_codes}'`)
      throw new BadRequestError('Bar code already exists')
    }

    const result = await ProductRepository.create(payload)
    return result
  }

  async update (payload: IProduct, productId: string): Promise<IProductResponse | null> {
    if (!Types.ObjectId.isValid(productId)) {
      Logger.error(`[PUT /api/v1/product/:id]: ID:'${productId}' is not in a valid ID format`)
      throw new BadRequestError('Not an valid ID')
    }
    const foundProduct = await ProductRepository.getOne(productId)
    if (!foundProduct) {
      Logger.error(`[PUT /api/v1/product/:id]: ID:'${productId}' doesnt exist or was deleted`)
      throw new NotFoundError('Product doesnt exist or was deleted')
    }
    const foundBarCode = await ProductRepository.getByBarCode(payload.bar_codes)
    if (foundBarCode && foundBarCode._id.toString() !== productId) {
      Logger.error(`[PUT /api/v1/product/:id]: Bar code already exists: '${payload.bar_codes}'`)
      throw new BadRequestError('Bar code already exists')
    }

    payload.stock_control_enabled = payload.qtd_stock > 0

    payload.updatedAt = new Date()

    const result = await ProductRepository.update(payload, productId)
    return result
  }

  async patch (payload: IProduct, productId: string): Promise<IProductResponse | null> {
    if (!Types.ObjectId.isValid(productId)) {
      Logger.error(`[PATCH /api/v1/product/:id]: ID:'${productId}' is not in a valid ID format`)
      throw new BadRequestError('Not an valid ID')
    }
    const foundProduct = await ProductRepository.getOne(productId)
    if (!foundProduct) {
      Logger.error(`[PATCH /api/v1/product/:id]: ID:'${productId}' doesnt exist or was deleted`)
      throw new NotFoundError('Product doesnt exist or was deleted')
    }
    const foundBarCode = await ProductRepository.getByBarCode(payload.bar_codes)
    if (foundBarCode && foundBarCode._id.toString() !== productId) {
      Logger.error(`[PATCH /api/v1/product/:id]: Bar code already exists: '${payload.bar_codes}'`)
      throw new BadRequestError('Bar code already exists')
    }

    if (payload.qtd_stock !== undefined) {
      payload.stock_control_enabled = payload.qtd_stock > 0
    } else {
      payload.stock_control_enabled = foundProduct.qtd_stock > 0
    }

    payload.updatedAt = new Date()

    const result = await ProductRepository.patch(payload, productId)
    return result
  }

  async get (brand:string, department: string, offset: number, limit: number) {
    const result = await ProductRepository.get(brand, department, offset, limit)
    return result
  }

  async getLowStock (offset: number, limit: number) {
    const result = await ProductRepository.getLowStock(offset, limit)
    return result
  }

  async getOne (productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      Logger.error(`[GET /api/v1/product/:id]: ID:'${productId}' is not in a valid ID format`)
      throw new BadRequestError('Not an valid ID')
    }

    const foundProduct = await ProductRepository.getOne(productId)
    if (!foundProduct) {
      Logger.error(`[GET /api/v1/product/:id]: ID:'${productId}' doesnt exist or was deleted`)
      throw new NotFoundError('Product doesnt exist or was deleted')
    }

    const result = await ProductRepository.getOne(productId)
    return result
  }

  async getMapper (productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      Logger.error(`[GET /api/v1/product/marketplace/:id]: ID:'${productId}' is not in a valid ID format`)
      throw new BadRequestError('Not an valid ID')
    }

    const foundProduct: IProductResponse | null = await ProductRepository.getOne(productId)
    if (!foundProduct) {
      Logger.error(`[GET /api/v1/product/marketplace/:id]: ID:'${productId}' doesnt exist or was deleted`)
      throw new NotFoundError('Product doesnt exist or was deleted')
    }

    const mapperFields: any = mapper.fields

    const dataTypes: Array<string> = []
    const fieldProduct: Array<string> = []
    const fieldMarket: Array<Array<string>> = []
    const lastFMarketKey: Array<string> = []
    const optional: Array<boolean> = []

    for (const value of mapperFields) {
      dataTypes.push(value.type)
      fieldProduct.push(value.fieldProduct.split('.')[1])
      fieldMarket.push(value.fieldMarket.split('.'))
      lastFMarketKey.push(value.fieldMarket.split('.')[value.fieldMarket.split('.').length - 1])
      optional.push(value.optional)
    }

    const finalProduct: Object = {}
    for (let i = 0; i < lastFMarketKey.length; i++) {
      switch (dataTypes[i]) {
        case 'text':
          finalProduct[lastFMarketKey[i]] = (foundProduct[fieldProduct[i]]).toString()
          break
        case 'number':
          finalProduct[lastFMarketKey[i]] = parseFloat(foundProduct[fieldProduct[i]])
          if (isNaN(finalProduct[lastFMarketKey[i]])) {
            Logger.error(`[GET /api/v1/product/marketplace/:id] (ID:'${productId}') field '${[lastFMarketKey[i]]}'/'${fieldProduct[i]}' cant be converted to number`)
            throw new BadRequestError(`The field ${lastFMarketKey[i]} cant be a number`)
          }
          break
        case 'array':
          finalProduct[lastFMarketKey[i]] = [foundProduct[fieldProduct[i]]]
          break
        case 'boolean':
          finalProduct[lastFMarketKey[i]] = foundProduct[fieldProduct[i]]
          if (typeof finalProduct[lastFMarketKey[i]] !== 'boolean') {
            Logger.error(`[GET /api/v1/product/marketplace/:id] (ID:'${productId}') field '${[lastFMarketKey[i]]}'/'${fieldProduct[i]}' cant be converted to boolean`)
            throw new BadRequestError(`The field ${lastFMarketKey[i]} cant be a boolean`)
          }
          break
      }
      if (mapperFields[i].optional !== undefined) {
        switch (mapperFields[i].optional[0]) {
          case 'break':
            finalProduct[lastFMarketKey[i]] = finalProduct[lastFMarketKey[i]].toString()
            const valueLength = (finalProduct[lastFMarketKey[i]]).length
            const breaked = (finalProduct[lastFMarketKey[i]]).match(new RegExp(`.{${mapperFields[i].optional[1]}}`, 'g'))
            breaked.push((finalProduct[lastFMarketKey[i]]).slice(valueLength - (valueLength % mapperFields[i].optional[1])))
            if (valueLength % mapperFields[i].optional[1] === 0) {
              breaked.pop()
            }
            finalProduct[lastFMarketKey[i]] = breaked
            break
          case 'currency':
            finalProduct[lastFMarketKey[i]] = Number(finalProduct[lastFMarketKey[i]]).toLocaleString(mapperFields[i].optional[1], { style: 'currency', currency: mapperFields[i].optional[2] })
        }
      }
    }

    function buildMapperProduct (fieldMarket: Array<Array<string>>) {
      const marketplace = {}
      for (const prop of fieldMarket) {
        let obj = marketplace
        for (const p of prop) {
          obj = obj[p] = finalProduct[p] = obj[p] = finalProduct[p] || {}
        }
      }
      return marketplace
    }

    return buildMapperProduct(fieldMarket)
  }

  async delete (productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      Logger.error(`[DELETE /api/v1/product/:id]: ID:'${productId}' is not in a valid ID format`)
      throw new BadRequestError('Not an valid ID')
    }
    const foundProduct = await ProductRepository.getOne(productId)
    if (!foundProduct) {
      Logger.error(`[DELETE /api/v1/product/:id]: ID:'${productId}' doesnt exist or was already deleted`)
      throw new NotFoundError('Product doesnt exist or was already deleted')
    }

    const result = await ProductRepository.delete(productId)
    return result
  }

  async createCSV (file: any): Promise<any> {
    const { buffer } = file

    const readableFile = new Readable()
    readableFile.push(buffer)
    readableFile.push(null)

    const productsLine = readline.createInterface({
      input: readableFile
    })

    const products: any[] = []

    for await (const line of productsLine) {
      const productLineSplit = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)

      products.push({
        title: productLineSplit[0].replace(/["\\]+/g, ''),
        description: productLineSplit[1],
        department: productLineSplit[2],
        brand: productLineSplit[3],
        price: Number(productLineSplit[4].replace(',', '.').replace(/['"]+/g, '')),
        qtd_stock: Number(productLineSplit[5]),
        bar_codes: productLineSplit[6].replace(/["\\]+/g, '')

      })
    }

    const productKeys = Object.keys(products[1])
    const error: any[] = []
    let errorCounter: number = 0
    let successCounter: number = 0

    for (let i = 0; i < products.length; i++) {
      let productErrors = 0

      const errorMsg: string[] = []
      let singleErrorMsg: string
      const errorProduct: object = { title: products[i].title, bar_codes: products[i].bar_codes, error: errorMsg }

      async function checkNullOrUndefined (value: string | number | null) {
        if (!value && value !== 0) {
          productErrors++
          errorCounter++
          return true
        }
      }

      async function checkIfString (content: string | number, key: string) {
        if (typeof content !== 'string' && key !== 'price' && key !== 'qtd_stock') {
          productErrors++
          errorCounter++
          return true
        }
      }

      async function checkIfNumber (content: number, key: string) {
        if (isNaN(content) && (key === 'price' || key === 'qtd_stock')) {
          productErrors++
          errorCounter++
          return true
        }
      }

      for (const key of productKeys) {
        if (await checkNullOrUndefined(products[i][key])) {
          singleErrorMsg = `${key} is null or undefined`
          errorMsg.push(singleErrorMsg)
        }

        if (await checkIfString(products[i][key], key)) {
          singleErrorMsg = `${key} must be a string`
          errorMsg.push(singleErrorMsg)
        }

        if (await checkIfNumber(products[i][key], key)) {
          singleErrorMsg = `${key} must be a number`
          errorMsg.push(singleErrorMsg)
        }
      }

      if (products[i].qtd_stock < 1 || products[i].qtd_stock > 100000) {
        errorMsg.push('Stock quantity must be minimum 1 and at max 100000')
        errorCounter++
        productErrors++
      }

      if (products[i].bar_codes.length !== 13) {
        errorMsg.push('bar codes length must be 13')
        errorCounter++
        productErrors++
      }

      if (products[i].bar_codes.length === 13 && !products[i].bar_codes.match(/^[0-9]{13}$/)) {
        errorMsg.push('bar codes must be a string of numbers')
        errorCounter++
        productErrors++
      }

      if (products[i].qtd_stock < 0 || products[i].qtd_stock > 100000) {
        errorMsg.push('stock must be between 0 and 100.000')
        errorCounter++
        productErrors++
      }

      if (products[i].price < 0.01 || products[i].price > 1000) {
        errorMsg.push('price must be between 0.01 and 1000')
        errorCounter++
        productErrors++
      }

      const foundBarCode = await ProductRepository.getByBarCode(products[i].bar_codes)
      if (foundBarCode) {
        errorMsg.push('bar code already exists')
        errorCounter++
        productErrors++
      }
      if (productErrors === 0) {
        ProductRepository.create(products[i])
        successCounter++
      }
      if (productErrors === 1) {
        singleErrorMsg = errorMsg[0]
        Logger.error(`[POST /api/v1/product/csv] Product '${products[i].title}' with bar code '${products[i].bar_codes}' has an error: '${singleErrorMsg}'`)
        error.push({ title: products[i].title, bar_codes: products[i].bar_codes, error: singleErrorMsg })
      }
      if (productErrors > 1) {
        Logger.error(`[POST /api/v1/product/csv] Product '${products[i].title}' with bar code '${products[i].bar_codes}' has multiple errors: '${errorMsg}'`)
        error.push(errorProduct)
      }
    }

    return {
      sucess: successCounter,
      errors: errorCounter,
      error_details: error
    }
  }
}

export default new ProductService()
