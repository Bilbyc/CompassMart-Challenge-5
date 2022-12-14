import Joi from 'joi'
import { Request, Response, NextFunction } from 'express'
import Logger from '../../utils/loggers/winstonConfig'

export default async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = Joi.object({
      title: Joi.string().required(),
      description: Joi.string().required(),
      department: Joi.string().required(),
      brand: Joi.string().required(),
      price: Joi.number().required().min(0.01).max(1000),
      qtd_stock: Joi.number().required().min(1).less(100001),
      bar_codes: Joi.string().required().length(13).regex(/^[0-9]{13}$/)
    })

    const { error } = await schema.validate(req.body, { abortEarly: false })
    if (error) throw error
    return next()
  } catch (error) {
    Logger.error(`[POST /api/v1/product]: ${error}`)
    return res.status(400).json({
      message: 'Bad Request Error',
      errors: error.details.length,
      details: error.details.map(e => e.message)
    })
  }
}
