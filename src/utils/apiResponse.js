// Standardizes all API responses so the frontend always gets
//a predictable JSON structure.
class ApiResponse {
  static success(res, data, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      status: "success",
      message,
      data,
    });
  }

  static created(res, data, message = "Created successfully") {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, data, pagination, message = "Success") {
    return res.status(200).json({
      status: "success",
      message,
      data,
      pagination,
    });
  }
}

module.exports = ApiResponse;
